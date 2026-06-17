import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Character,
  CombatState,
  Enemy,
  EquipmentSlot,
  EquipmentSlots,
  GameScreen,
  GameState,
  GameStats,
  Item,
  Location,
  NarrativeType,
  Quest,
  QuestObjectiveType,
  SkillCheckRequest,
  StatusEffect,
  WorldFlags,
} from '../types';
import { equipmentSlotFor, recomputeAC } from '../engine/character/equipment';
import {
  MAX_LEVEL,
  XP_THRESHOLDS,
  classFeatures,
  proficiencyForLevel,
  rollHitDie,
  xpToNextFor,
} from '../engine/character/progression';
import { abilityModifier, getIntroNarrative } from '../engine/character/creation';
import { STAT_LABELS_RU } from '../engine/character/data';
import {
  clamp,
  clampGeneratedEnemy,
  clampGeneratedItem,
  clampGoldChange,
  clampNarrativeHp,
  clampXpGain,
} from '../engine/world/validation';
import { createStartingLocation } from '../engine/world/bootstrap';
import { findExistingLocationByName, findExistingNpcByName } from '../engine/world/dedupe';
import { initCombat, tickWorldStatusEffects } from '../engine/combat/system';
import type { StatusTickResult } from '../engine/combat/system';
import { effectNameRu } from '../engine/combat/statusLabels';
import { GroqError, groqService } from '../engine/ai/groqService';
import type { DMResponse } from '../engine/ai/groqService';
import { messageHistory } from '../engine/ai/messageHistory';
import { hasApiKey } from '../engine/ai/settings';
import { buildSummarizationPrompt } from '../engine/ai/prompts';
import type { GameContext } from '../engine/ai/prompts';

/** Crypto-backed id with a safe fallback for non-secure contexts. */
function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEquipment(): EquipmentSlots {
  return {
    head: null,
    body: null,
    hands: null,
    legs: null,
    mainHand: null,
    offHand: null,
    ring1: null,
    ring2: null,
    amulet: null,
  };
}

function createStats(): GameStats {
  return { turnsPlayed: 0, enemiesKilled: 0, goldFound: 0, roomsExplored: 0, deathCount: 0, questsCompleted: 0 };
}

/** Fresh, character-less game state used on boot and reset. */
function createInitialState(): GameState {
  return {
    screen: 'title',
    character: null,
    combat: null,
    inventory: [],
    equipped: createEquipment(),
    quests: [],
    narrativeLog: [],
    gameStats: createStats(),
    isLoading: false,
    savedAt: null,
    pendingLevelUps: [],
    locations: {},
    currentLocationId: null,
    depth: 1,
    resolvedCombatAt: {},
    worldFlags: {},
    npcs: {},
    npcMemory: {},
    pendingRoll: null,
    storySummary: '',
    summarizedUpToTurn: 0,
    hasAutosaved: false,
  };
}

/**
 * Copy live combat HP/status back onto the current location's enemy objects.
 * Immer gives `combat.enemies` and `location.enemiesPresent` independent draft
 * paths, so damage dealt during combat never reaches the location copy by
 * itself. Safe to call with no combat / location / matching enemies (no-op),
 * and idempotent (re-assigning the same values changes nothing).
 */
function syncCombatEnemiesIntoLocation(s: GameState): void {
  if (!s.combat || !s.currentLocationId) return;
  const loc = s.locations[s.currentLocationId];
  if (!loc) return;
  for (const combatEnemy of s.combat.enemies) {
    const locEnemy = loc.enemiesPresent.find((e) => e.id === combatEnemy.id);
    if (locEnemy) {
      locEnemy.hp = combatEnemy.hp;
      locEnemy.statusEffects = combatEnemy.statusEffects;
    }
  }
}

/** Imperative actions exposed alongside the {@link GameState}. */
export interface GameActions {
  setScreen: (screen: GameScreen) => void;
  beginCreation: () => void;
  startNewGame: (character: Character) => void;
  resetGame: () => void;
  addNarrative: (text: string, type?: NarrativeType) => void;
  clearNarrative: () => void;
  updateHp: (delta: number) => void;
  addXp: (amount: number) => void;
  addGold: (amount: number) => void;
  addItem: (item: Item) => void;
  removeItem: (itemId: string) => void;
  equipItem: (item: Item) => void;
  unequipItem: (slot: EquipmentSlot) => void;
  consumePendingLevelUp: () => void;
  addQuest: (quest: Quest) => void;
  advanceObjective: (questId: string, objectiveId: string, amount?: number) => void;
  setCombat: (combat: CombatState) => void;
  endCombat: () => void;
  damageEnemy: (enemyId: string, amount: number) => void;
  addCombatLog: (text: string) => void;
  nextCombatRound: () => void;
  setStatusEffects: (effects: StatusEffect[]) => void;
  setLoading: (loading: boolean) => void;
  incrementTurns: () => void;
  markAutosaved: () => void;
  loadState: (state: GameState) => void;

  // --- World model (Phase 7) ---
  setWorldFlags: (flags: WorldFlags) => void;
  applyStatusEffects: (add: StatusEffect[], remove: StatusEffect[]) => void;
  applyStatChanges: (changes: NonNullable<DMResponse['statChanges']>) => void;
  consumeItemsByName: (names: string[]) => void;
  addLocationLore: (text: string) => void;
  introduceNpc: (npc: NonNullable<DMResponse['npcIntroduced']>) => void;
  addDynamicQuest: (quest: NonNullable<DMResponse['newQuest']>) => void;
  clearLocationEnemies: () => { blocked: boolean; survivor?: Enemy };
  createAndMoveToLocation: (spec: NonNullable<DMResponse['newLocation']>) => string;
  moveToExistingLocation: (spec: NonNullable<DMResponse['moveToLocation']>) => boolean;
  updateCurrentLocation: (update: NonNullable<DMResponse['currentLocationUpdate']>) => void;
  markCombatResolved: (locationId: string) => void;
  triggerSkillCheck: (req: SkillCheckRequest) => void;
  clearPendingRoll: () => void;

  // --- Phase 8 ---
  tickStatusEffectsForTurn: () => { messages: StatusTickResult['messages']; defeated: boolean };
  setStorySummary: (text: string, atTurn: number) => void;

  // --- Phase 9 ---
  setNpcAttitude: (npcId: string, attitude: 'hostile' | 'neutral' | 'friendly') => void;
  logNpcInteraction: (npcId: string, summary: string) => void;
  processShopPurchase: (npcId: string, itemName: string, price: number) => boolean;

  // --- Phase 10 ---
  processShopSale: (npcId: string, itemName: string) => { success: boolean; gold: number };

  // --- AI orchestration (Phase 7) ---
  submitPlayerAction: (action: string) => Promise<void>;
  resolveSkillCheck: (total: number, success: boolean) => Promise<void>;
}

export type GameStore = GameState & GameActions;

export const useGameStore = create<GameStore>()(
  immer((set, get) => {
    // -----------------------------------------------------------------------
    // Internal helpers (close over set/get). Not part of the public actions.
    // -----------------------------------------------------------------------

    function currentLocation(): Location | null {
      const s = get();
      return s.currentLocationId ? s.locations[s.currentLocationId] ?? null : null;
    }

    function buildContext(): GameContext | null {
      const s = get();
      if (!s.character || !s.currentLocationId) return null;
      return {
        character: s.character,
        inventory: s.inventory,
        quests: s.quests,
        recentEvents: s.narrativeLog.slice(-5).map((e) => e.text),
        locations: s.locations,
        currentLocationId: s.currentLocationId,
        depth: s.depth,
        combat: s.combat,
        worldFlags: s.worldFlags,
        npcs: s.npcs,
        npcMemory: s.npcMemory,
        storySummary: s.storySummary,
      };
    }

    /** Every 15 turns, compress the story in the background (fire-and-forget). */
    function maybeSummarize(): void {
      const s = get();
      const turns = s.gameStats.turnsPlayed;
      if (turns <= 0 || turns % 15 !== 0 || turns <= s.summarizedUpToTurn) return;
      const recentTexts = s.narrativeLog
        .filter((e) => e.type === 'narration' || e.type === 'action' || e.type === 'system')
        .slice(-30)
        .map((e) => e.text);
      const prompt = buildSummarizationPrompt(s.storySummary, s.worldFlags, recentTexts);
      void groqService.summarizeStory(prompt).then((summary) => {
        if (summary) get().setStorySummary(summary, turns);
      });
    }

    /** Begin combat with the location's living enemies, if any (and not busy). */
    function startCombatIfEnemies(trigger: boolean, respectResolved = false): void {
      if (!trigger) return;
      const s = get();
      if (s.combat?.active || !s.character) return;
      const loc = currentLocation();
      if (!loc) return;
      if (respectResolved && s.resolvedCombatAt[loc.id]) return;
      const living = loc.enemiesPresent.filter((e) => e.hp > 0);
      if (living.length === 0) return;
      s.setCombat(initCombat(living, s.character));
    }

    function handleAiError(err: unknown): void {
      if (err instanceof GroqError && err.code === 'no-key') {
        get().addNarrative('⚠ Ключ Groq не задан. Открой Настройки и введи ключ.', 'system');
      } else {
        console.error('[DM] request failed', err);
        get().addNarrative('⚠ Мастер Подземелий не отвечает (ошибка связи). Проверь ключ ИИ и доступ к Groq.', 'system');
      }
    }

    /** Apply a DMResponse to game state in the Phase-7 order. */
    async function applyDMResponse(response: DMResponse, playerInput?: string): Promise<void> {
      const a = get();
      a.addNarrative(response.narrative, 'narration');

      // 1. In-place location changes.
      if (response.currentLocationUpdate) a.updateCurrentLocation(response.currentLocationUpdate);
      if (response.locationLore) a.addLocationLore(response.locationLore);

      // 2. Permanent stat changes BEFORE hp (CON can shift maxHp).
      if (response.statChanges?.length) a.applyStatChanges(response.statChanges);

      // 3. HP and status effects.
      if (response.hpChange) {
        const target = get().character;
        if (target) {
          const hp = clampNarrativeHp(response.hpChange, target.maxHp);
          if (hp !== 0) {
            a.updateHp(hp);
            a.addNarrative(hp > 0 ? `💚 +${hp} HP` : `💔 ${hp} HP`, hp > 0 ? 'loot' : 'combat');
          }
        }
      }
      if (response.statusEffects && (response.statusEffects.add?.length || response.statusEffects.remove?.length)) {
        a.applyStatusEffects(response.statusEffects.add ?? [], response.statusEffects.remove ?? []);
        response.statusEffects.add?.forEach((effect) => a.addNarrative(`Состояние: ${effectNameRu(effect.type)}`, 'system'));
      }

      // 4. Inventory / gold / xp.
      if (response.itemsConsumed?.length) a.consumeItemsByName(response.itemsConsumed);
      if (response.shopPurchase) {
        // Explicit purchase path — takes priority over itemFound/goldChange.
        const { npcId, itemName, price } = response.shopPurchase;
        const ok = a.processShopPurchase(npcId, itemName, price);
        if (ok) a.addNarrative(`Куплено: ${itemName} за ${price}з`, 'loot');
        if (response.itemFound || response.goldChange) {
          console.warn('[DM] shopPurchase present — ignoring itemFound/goldChange in the same response');
        }
      } else {
        if (response.itemFound) {
          const item = clampGeneratedItem(response.itemFound, true);
          a.addItem(item);
          a.addNarrative(`Найдено: ${item.name}`, 'loot');
        }
        if (response.goldChange) {
          const gold = clampGoldChange(response.goldChange, get().depth);
          if (gold !== 0) {
            a.addGold(gold);
            a.addNarrative(gold > 0 ? `+${gold} золота` : `Потеряно ${Math.abs(gold)} золота`, 'loot');
          }
        }
      }
      if (response.shopSale) {
        const sale = a.processShopSale(response.shopSale.npcId, response.shopSale.itemName);
        if (sale.success) a.addNarrative(`Продано: ${response.shopSale.itemName} за ${sale.gold}з`, 'loot');
      }
      if (response.xpGained) {
        const xp = clampXpGain(response.xpGained, get().character?.level ?? 1);
        if (xp > 0) {
          a.addXp(xp);
          a.addNarrative(`+${xp} опыта`, 'system');
        }
      }

      // 5. NPCs and quests.
      if (response.npcIntroduced) a.introduceNpc(response.npcIntroduced);
      if (response.attitudeChange) a.setNpcAttitude(response.attitudeChange.npcId, response.attitudeChange.attitude);
      const involvedNpcId = response.attitudeChange?.npcId ?? response.npcIntroduced?.id;
      if (involvedNpcId && playerInput && playerInput.length < 200) {
        a.logNpcInteraction(involvedNpcId, playerInput);
      }
      if (response.newQuest) a.addDynamicQuest(response.newQuest);
      if (response.questUpdate) a.advanceObjective(response.questUpdate.questId, response.questUpdate.objectiveId);

      // 6. World facts.
      if (response.worldFlags) a.setWorldFlags(response.worldFlags);

      // 7. mustFight guard BEFORE combatStart.
      let forcedCombat = false;
      if (response.clearLocationEnemies) {
        const result = a.clearLocationEnemies();
        if (result.blocked && result.survivor) {
          a.addNarrative(`Что-то идёт не так... ${result.survivor.name} оказывается жив — твоя хитрость провалилась!`, 'combat');
          forcedCombat = true;
        }
      }

      // 8. Combat (ambush enemies join the current location first).
      if (response.combatStart?.ambushEnemies?.length) {
        const depth = get().depth;
        const ambush = response.combatStart.ambushEnemies.map((e) => clampGeneratedEnemy(e, depth));
        set((st) => {
          const loc = st.currentLocationId ? st.locations[st.currentLocationId] : null;
          if (loc) loc.enemiesPresent.push(...ambush);
        });
      }
      let combatJustStarted = false;
      if (forcedCombat || response.combatStart) {
        const loc = currentLocation();
        const living = loc ? loc.enemiesPresent.filter((e) => e.hp > 0) : [];
        if (living.length > 0) {
          startCombatIfEnemies(true);
          combatJustStarted = !!get().combat?.active;
        } else if (response.combatStart) {
          console.warn('[DM] combatStart requested but no living enemies present');
        }
      }

      // 9. Skill check interrupts the rest — unless combat just started (combat wins).
      if (response.requiresRoll) {
        if (combatJustStarted) {
          console.warn('[DM] both combatStart and requiresRoll returned — ignoring requiresRoll');
        } else {
          a.triggerSkillCheck(response.requiresRoll);
          return;
        }
      }

      // 10. Navigation, last.
      if (response.newLocation) {
        const before = get().currentLocationId;
        const newId = a.createAndMoveToLocation(response.newLocation);
        // If the AI "recreated" the CURRENT location, treat it as an update, not a move.
        if (newId !== before) {
          const loc = currentLocation();
          if (loc) {
            a.addNarrative(loc.description, 'narration');
            startCombatIfEnemies(true);
          }
        }
      } else if (response.moveToLocation) {
        const moved = a.moveToExistingLocation(response.moveToLocation);
        if (moved) {
          const loc = currentLocation();
          if (loc) {
            a.addNarrative(loc.description, 'narration');
            startCombatIfEnemies(true, true);
          }
        } else {
          console.warn('[DM] unknown moveToLocation id', response.moveToLocation.locationId);
        }
      }
    }

    return {
      ...createInitialState(),

      setScreen: (screen) =>
        set((state) => {
          state.screen = screen;
        }),

      // Title screen -> start the creation wizard with a clean slate.
      beginCreation: () => {
        messageHistory.clear();
        set((state) => {
          Object.assign(state, createInitialState());
          state.screen = 'character-creation';
        });
      },

      // Creation wizard -> commit the built hero and bootstrap the world.
      startNewGame: (character) => {
        messageHistory.clear();
        set((state) => {
          Object.assign(state, createInitialState());
          state.character = character;
          state.screen = 'game';
          const location = createStartingLocation();
          state.locations = { [location.id]: location };
          state.currentLocationId = location.id;
          state.depth = 1;
          state.narrativeLog.push({ id: createId(), type: 'narration', text: getIntroNarrative(character.class), timestamp: Date.now() });
          state.narrativeLog.push({ id: createId(), type: 'narration', text: location.description, timestamp: Date.now() });
        });
      },

      resetGame: () => {
        messageHistory.clear();
        set((state) => {
          Object.assign(state, createInitialState());
        });
      },

      addNarrative: (text, type = 'narration') =>
        set((state) => {
          state.narrativeLog.push({ id: createId(), type, text, timestamp: Date.now() });
        }),

      clearNarrative: () =>
        set((state) => {
          state.narrativeLog = [];
        }),

      // Apply an HP delta, clamp to [0, maxHp], trigger game over at 0.
      updateHp: (delta) =>
        set((state) => {
          const { character } = state;
          if (!character) return;
          character.hp = Math.max(0, Math.min(character.maxHp, character.hp + delta));
          if (character.hp === 0) {
            state.screen = 'game-over';
          }
        }),

      addXp: (amount) =>
        set((state) => {
          const c = state.character;
          if (!c) return;
          c.xp += amount;
          while (c.level < MAX_LEVEL && c.xp >= XP_THRESHOLDS[c.level + 1]) {
            const oldLevel = c.level;
            const oldMaxHp = c.maxHp;
            const oldProf = c.proficiencyBonus;
            const newLevel = c.level + 1;
            const hpGained = Math.max(1, rollHitDie(c.class) + c.modifiers.con);
            c.level = newLevel;
            c.maxHp += hpGained;
            c.hp += hpGained;
            c.proficiencyBonus = proficiencyForLevel(newLevel);
            c.xpToNext = xpToNextFor(newLevel);
            const features = classFeatures(c.class, newLevel);
            state.narrativeLog.push({
              id: createId(),
              type: 'system',
              text: `✦ Новый уровень! Теперь ты ${newLevel} уровня.${features[0] ? ` ${features[0]}` : ''}`,
              timestamp: Date.now(),
            });
            state.pendingLevelUps.push({
              oldLevel,
              newLevel,
              hpGained,
              oldMaxHp,
              newMaxHp: c.maxHp,
              oldProf,
              newProf: c.proficiencyBonus,
              features,
            });
          }
        }),

      addGold: (amount) =>
        set((state) => {
          if (!state.character) return;
          state.character.gold = Math.max(0, state.character.gold + amount);
          if (amount > 0) state.gameStats.goldFound += amount;
        }),

      // Stack consumables (potions) by name; never stack gear (hidden stat diffs).
      addItem: (item) =>
        set((state) => {
          if (item.type === 'potion') {
            const existing = state.inventory.find((i) => i.type === 'potion' && i.name === item.name);
            if (existing) {
              existing.quantity = (existing.quantity ?? 1) + (item.quantity ?? 1);
              return;
            }
          }
          state.inventory.push({ ...item, quantity: item.quantity ?? 1 });
        }),

      // Decrement a stack; only splice the slot once the last unit is gone.
      removeItem: (itemId) =>
        set((state) => {
          const index = state.inventory.findIndex((item) => item.id === itemId);
          if (index === -1) return;
          const item = state.inventory[index];
          if ((item.quantity ?? 1) > 1) item.quantity = (item.quantity ?? 1) - 1;
          else state.inventory.splice(index, 1);
        }),

      equipItem: (item) =>
        set((state) => {
          const character = state.character;
          if (!character) return;
          let slot = equipmentSlotFor(item);
          if (!slot) return;
          if (slot === 'ring1' && state.equipped.ring1) slot = 'ring2';
          const index = state.inventory.findIndex((i) => i.id === item.id);
          if (index === -1) return;
          state.inventory.splice(index, 1);
          const previous = state.equipped[slot];
          if (previous) state.inventory.push(previous);
          state.equipped[slot] = item;
          character.ac = recomputeAC(character, state.equipped);
        }),

      unequipItem: (slot) =>
        set((state) => {
          const character = state.character;
          const item = state.equipped[slot];
          if (!character || !item) return;
          state.equipped[slot] = null;
          state.inventory.push(item);
          character.ac = recomputeAC(character, state.equipped);
        }),

      consumePendingLevelUp: () =>
        set((state) => {
          state.pendingLevelUps.shift();
        }),

      addQuest: (quest) =>
        set((state) => {
          state.quests.push(quest);
        }),

      advanceObjective: (questId, objectiveId, amount = 1) => {
        let xpToAward = 0;
        set((state) => {
          const quest = state.quests.find((q) => q.id === questId);
          if (!quest) {
            console.warn('[DM] questUpdate: unknown questId', questId);
            return;
          }
          const objective = quest.objectives.find((o) => o.id === objectiveId);
          if (!objective) {
            console.warn('[DM] questUpdate: unknown objectiveId', objectiveId);
            return;
          }
          objective.current = Math.min(objective.target, objective.current + amount);
          objective.isComplete = objective.current >= objective.target;
          if (quest.objectives.every((o) => o.isComplete) && quest.status === 'active') {
            quest.status = 'completed';
            state.gameStats.questsCompleted = (state.gameStats.questsCompleted ?? 0) + 1;
            xpToAward = quest.rewards.xp ?? 0;
            if (quest.rewards.gold && state.character) state.character.gold += quest.rewards.gold;
            if (quest.rewards.items?.length) {
              state.inventory.push(...quest.rewards.items.map((i) => ({ ...i, id: createId(), quantity: i.quantity ?? 1 })));
            }
            state.narrativeLog.push({
              id: createId(),
              type: 'quest',
              timestamp: Date.now(),
              text:
                `✦ Квест завершён: "${quest.title}"` +
                (quest.rewards.gold ? ` (+${quest.rewards.gold} золота)` : '') +
                (quest.rewards.items?.length ? ` (+${quest.rewards.items.length} предмет(ов))` : ''),
            });
          }
        });
        // addXp runs its own multi-level-up loop — must be called OUTSIDE the set() above.
        if (xpToAward > 0) get().addXp(xpToAward);
      },

      setCombat: (combat) =>
        set((state) => {
          state.combat = combat;
        }),

      endCombat: () =>
        set((state) => {
          // Persist combat damage to the location before discarding the fight
          // (covers flee / non-victory exits).
          syncCombatEnemiesIntoLocation(state);
          state.combat = null;
        }),

      damageEnemy: (enemyId, amount) =>
        set((state) => {
          const enemy = state.combat?.enemies.find((e) => e.id === enemyId);
          if (enemy) enemy.hp = Math.max(0, Math.min(enemy.maxHp, enemy.hp - amount));
        }),

      addCombatLog: (text) =>
        set((state) => {
          if (state.combat) {
            state.combat.log.push({ id: createId(), text, timestamp: Date.now() });
          }
        }),

      nextCombatRound: () =>
        set((state) => {
          if (state.combat) state.combat.round += 1;
        }),

      setStatusEffects: (effects) =>
        set((state) => {
          if (state.character) state.character.statusEffects = effects;
        }),

      setLoading: (loading) =>
        set((state) => {
          state.isLoading = loading;
        }),

      incrementTurns: () =>
        set((state) => {
          state.gameStats.turnsPlayed += 1;
        }),

      markAutosaved: () =>
        set((state) => {
          state.hasAutosaved = true;
        }),

      loadState: (loaded) => {
        messageHistory.clear();
        set((state) => {
          Object.assign(state, loaded);
        });
      },

      // -------------------------------------------------------------------
      // World model (Phase 7)
      // -------------------------------------------------------------------

      setWorldFlags: (flags) =>
        set((state) => {
          Object.assign(state.worldFlags, flags);
        }),

      applyStatusEffects: (add, remove) =>
        set((state) => {
          const c = state.character;
          if (!c) return;
          if (remove.length) {
            const rm = new Set(remove.map((e) => e.type));
            c.statusEffects = c.statusEffects.filter((e) => !rm.has(e.type));
          }
          for (const effect of add) {
            if (!c.statusEffects.some((x) => x.type === effect.type)) c.statusEffects.push(effect);
          }
        }),

      applyStatChanges: (changes) =>
        set((state) => {
          const c = state.character;
          if (!c) return;
          for (const change of changes) {
            const stat = change.stat;
            const delta = clamp(change.delta, -2, 2);
            const old = c.stats[stat];
            const next = clamp(old + delta, 1, 24);
            const actual = next - old;
            if (actual === 0) continue;
            c.stats[stat] = next;
            const oldMod = abilityModifier(old);
            const newMod = abilityModifier(next);
            c.modifiers[stat] = newMod;
            if (stat === 'con' && newMod !== oldMod) {
              const hpShift = (newMod - oldMod) * c.level;
              c.maxHp = Math.max(1, c.maxHp + hpShift);
              c.hp = clamp(c.hp + hpShift, 0, c.maxHp);
            }
            if (stat === 'dex' && newMod !== oldMod) {
              c.ac = recomputeAC(c, state.equipped);
            }
            state.narrativeLog.push({
              id: createId(),
              type: 'system',
              text: `✦ ${STAT_LABELS_RU[stat]} ${actual > 0 ? '+' : ''}${actual} (${change.reason})`,
              timestamp: Date.now(),
            });
            if (stat === 'str') {
              // Carry capacity (= str * 15) is computed live in InventoryPanel, so
              // no field to update — but warn if the lower limit is now exceeded.
              const newCapacity = c.stats.str * 15;
              const currentWeight = state.inventory.reduce((sum, i) => sum + i.weight * (i.quantity ?? 1), 0);
              if (currentWeight > newCapacity) {
                state.narrativeLog.push({
                  id: createId(),
                  type: 'system',
                  text: `⚠ Ты перегружен — грузоподъёмность снизилась до ${newCapacity} фунтов.`,
                  timestamp: Date.now(),
                });
              }
            }
          }
        }),

      consumeItemsByName: (names) =>
        set((state) => {
          for (const name of names) {
            const target = name.trim().toLowerCase();
            const index = state.inventory.findIndex((i) => i.name.toLowerCase() === target);
            if (index === -1) continue;
            const item = state.inventory[index];
            if ((item.quantity ?? 1) > 1) item.quantity = (item.quantity ?? 1) - 1;
            else state.inventory.splice(index, 1);
          }
        }),

      addLocationLore: (text) =>
        set((state) => {
          const loc = state.currentLocationId ? state.locations[state.currentLocationId] : null;
          if (!loc) return;
          const current = loc.lore ?? '';
          loc.lore = current.length + text.length > 600 ? text : current ? `${current}\n\n${text}` : text;
        }),

      introduceNpc: (npc) =>
        set((state) => {
          const existing = findExistingNpcByName(state.npcs, npc.name);
          if (existing && existing.id !== npc.id) {
            // Known character re-introduced under a different id — merge in place.
            existing.description = npc.description || existing.description;
            existing.role = npc.role || existing.role;
            if (npc.shopInventory) existing.shopInventory = npc.shopInventory.map((i) => clampGeneratedItem(i, false));
            const here = state.currentLocationId ? state.locations[state.currentLocationId] : null;
            if (here && !here.npcIds.includes(existing.id)) here.npcIds.push(existing.id);
            return;
          }
          const shopInventory = npc.shopInventory?.map((i) => clampGeneratedItem(i, false));
          state.npcs[npc.id] = {
            id: npc.id,
            name: npc.name,
            role: npc.role,
            description: npc.description,
            icon: npc.icon,
            dialogues: [],
            shopInventory,
          };
          if (!state.npcMemory[npc.id]) {
            state.npcMemory[npc.id] = { npcId: npc.id, interactions: [], attitude: 'neutral' };
          }
          const loc = state.currentLocationId ? state.locations[state.currentLocationId] : null;
          if (loc && !loc.npcIds.includes(npc.id)) loc.npcIds.push(npc.id);
        }),

      addDynamicQuest: (quest) =>
        set((state) => {
          const rewardItems = (quest.rewards.items ?? []).map((i) => clampGeneratedItem(i, true));
          const objectives = quest.objectives.map((o) => ({
            id: createId(),
            type: 'explore' as QuestObjectiveType,
            description: o.description,
            target: o.targetCount ?? 1,
            current: 0,
            isComplete: false,
          }));
          state.quests.push({
            id: createId(),
            title: quest.title,
            description: quest.description,
            type: 'side',
            objectives,
            rewards: {
              xp: quest.rewards.xp,
              gold: quest.rewards.gold,
              items: rewardItems.length > 0 ? rewardItems : undefined,
            },
            status: 'active',
          });
          state.narrativeLog.push({ id: createId(), type: 'quest', text: `✦ Новый квест: ${quest.title}`, timestamp: Date.now() });
        }),

      clearLocationEnemies: () => {
        const s = get();
        const loc = s.currentLocationId ? s.locations[s.currentLocationId] : null;
        if (!loc) return { blocked: false };
        const survivor = loc.enemiesPresent.find((e) => e.hp > 0 && e.mustFight);
        if (survivor && !s.resolvedCombatAt[loc.id]) {
          return { blocked: true, survivor };
        }
        set((state) => {
          const l = state.currentLocationId ? state.locations[state.currentLocationId] : null;
          if (l) l.enemiesPresent = l.enemiesPresent.filter((e) => e.hp <= 0);
        });
        return { blocked: false };
      },

      createAndMoveToLocation: (spec) => {
        const id = createId();
        let resultId = id;
        set((state) => {
          const current = state.currentLocationId ? state.locations[state.currentLocationId] : null;
          const existing = findExistingLocationByName(state.locations, spec.name);

          if (existing && current && existing.id === current.id) {
            // AI re-described the CURRENT place as "new" — just refresh the description.
            current.description = spec.description || current.description;
            resultId = current.id;
            return;
          }
          if (existing && current && existing.id !== current.id) {
            // AI re-created a known place — reuse it, link it and move there.
            existing.visitCount += 1;
            if (!current.connections.some((c) => c.toLocationId === existing.id)) {
              current.connections.push({ toLocationId: existing.id, label: spec.connectionLabel });
              existing.connections.push({ toLocationId: current.id, label: 'назад' });
            }
            state.currentLocationId = existing.id;
            state.depth = clamp(state.depth + (spec.depthDelta ?? 0), 1, 20);
            resultId = existing.id;
            return;
          }

          const enemies = (spec.enemies ?? []).map((e) => clampGeneratedEnemy(e, state.depth));
          const items = (spec.items ?? []).map((i) => clampGeneratedItem(i, true));
          const newLoc: Location = {
            id,
            name: spec.name,
            type: spec.type,
            description: spec.description,
            biome: spec.biome,
            enemiesPresent: enemies,
            itemsPresent: items,
            npcIds: [],
            connections: [],
            isSafeZone: spec.isSafeZone ?? false,
            visitCount: 1,
            discoveredAt: state.gameStats.turnsPlayed,
          };
          if (current) {
            current.connections.push({ toLocationId: id, label: spec.connectionLabel });
            newLoc.connections.push({ toLocationId: current.id, label: 'назад' });
          }
          state.locations[id] = newLoc;
          state.currentLocationId = id;
          state.depth = clamp(state.depth + (spec.depthDelta ?? 0), 1, 20);
          resultId = id;
        });
        return resultId;
      },

      moveToExistingLocation: (spec) => {
        if (!get().locations[spec.locationId]) return false;
        set((state) => {
          const target = state.locations[spec.locationId];
          if (!target) return;
          target.visitCount += 1;
          const current = state.currentLocationId ? state.locations[state.currentLocationId] : null;
          if (current && current.id !== target.id && !current.connections.some((cn) => cn.toLocationId === target.id)) {
            current.connections.push({ toLocationId: target.id, label: spec.connectionLabel ?? 'путь' });
            target.connections.push({ toLocationId: current.id, label: 'назад' });
          }
          state.currentLocationId = target.id;
        });
        return true;
      },

      updateCurrentLocation: (update) =>
        set((state) => {
          if (state.currentLocationId && state.locations[state.currentLocationId]) {
            Object.assign(state.locations[state.currentLocationId], update);
          }
        }),

      markCombatResolved: (locationId) =>
        set((state) => {
          // Pull final combat HP into the location first (idempotent), then drop
          // the defeated. On victory every fought enemy is at <=0 HP, so this
          // clears them while correctly preserving any survivor.
          syncCombatEnemiesIntoLocation(state);
          state.resolvedCombatAt[locationId] = true;
          const loc = state.locations[locationId];
          if (loc) {
            state.gameStats.enemiesKilled += loc.enemiesPresent.filter((e) => e.hp <= 0).length;
            loc.enemiesPresent = loc.enemiesPresent.filter((e) => e.hp > 0);
          }
        }),

      triggerSkillCheck: (req) =>
        set((state) => {
          state.pendingRoll = req;
        }),

      clearPendingRoll: () =>
        set((state) => {
          state.pendingRoll = null;
        }),

      // -------------------------------------------------------------------
      // Phase 8
      // -------------------------------------------------------------------

      tickStatusEffectsForTurn: () => {
        let out: { messages: StatusTickResult['messages']; defeated: boolean } = { messages: [], defeated: false };
        set((state) => {
          const c = state.character;
          if (!c || c.statusEffects.length === 0) return;
          const tick = tickWorldStatusEffects(c);
          c.hp = tick.hp;
          c.statusEffects = tick.statusEffects;
          out = { messages: tick.messages, defeated: tick.defeated };
          if (tick.defeated) {
            state.screen = 'game-over';
            state.gameStats.deathCount += 1;
          }
        });
        return out;
      },

      setStorySummary: (text, atTurn) =>
        set((state) => {
          state.storySummary = text;
          state.summarizedUpToTurn = atTurn;
        }),

      // -------------------------------------------------------------------
      // Phase 9
      // -------------------------------------------------------------------

      setNpcAttitude: (npcId, attitude) =>
        set((state) => {
          const mem = state.npcMemory[npcId];
          if (!mem) {
            console.warn('[DM] attitudeChange: unknown npcId', npcId);
            return;
          }
          mem.attitude = attitude;
        }),

      logNpcInteraction: (npcId, summary) =>
        set((state) => {
          const mem = state.npcMemory[npcId];
          if (!mem) return;
          mem.interactions.push(summary);
          if (mem.interactions.length > 5) mem.interactions.shift();
        }),

      processShopPurchase: (npcId, itemName, price) => {
        let success = false;
        set((state) => {
          if (!state.character || state.character.gold < price) return;
          const npc = state.npcs[npcId];
          const shopItem = npc?.shopInventory?.find((i) => i.name.toLowerCase() === itemName.toLowerCase());
          if (!shopItem) {
            console.warn('[DM] shopPurchase: item not found', itemName);
            return;
          }
          state.character.gold -= price;
          state.inventory.push({ ...shopItem, id: createId() });
          success = true;
        });
        return success;
      },

      processShopSale: (npcId, itemName) => {
        let result = { success: false, gold: 0 };
        set((state) => {
          if (!state.npcs[npcId]) {
            console.warn('[DM] shopSale: unknown npcId', npcId);
            return;
          }
          const index = state.inventory.findIndex((i) => i.name.toLowerCase() === itemName.toLowerCase());
          if (index === -1) {
            console.warn('[DM] shopSale: item not in inventory', itemName);
            return;
          }
          if (!state.character) return;
          const item = state.inventory[index];
          const sellPrice = Math.max(1, Math.round(item.value * 0.4)); // fixed 40%, not AI-decided
          if ((item.quantity ?? 1) > 1) item.quantity = (item.quantity ?? 1) - 1;
          else state.inventory.splice(index, 1);
          state.character.gold += sellPrice;
          result = { success: true, gold: sellPrice };
        });
        return result;
      },

      // -------------------------------------------------------------------
      // AI orchestration (Phase 7)
      // -------------------------------------------------------------------

      submitPlayerAction: async (action) => {
        const s = get();
        const trimmed = action.trim();
        if (s.isLoading || s.combat?.active || s.pendingRoll) return;
        if (!trimmed || !s.character || !s.currentLocationId) return;

        if (!hasApiKey()) {
          s.addNarrative(`> ${trimmed}`, 'action');
          s.addNarrative('⚠ Укажи ключ Groq в Настройках, чтобы Мастер Подземелий ожил.', 'system');
          return;
        }

        // Step 0: out-of-combat status tick (poison/bleed/burn + wear-off).
        const tick = s.tickStatusEffectsForTurn();
        tick.messages.forEach((m) => s.addNarrative(m.text, m.type));
        if (tick.defeated) return; // game-over already set; don't take the turn.

        s.addNarrative(`> ${trimmed}`, 'action');
        s.setLoading(true);
        s.incrementTurns();
        try {
          const ctx = buildContext();
          if (!ctx) return;
          const response = await groqService.sendMessage(trimmed, ctx, messageHistory.getHistory());
          messageHistory.addUserAction(trimmed);
          messageHistory.addDMResponse(response);
          await applyDMResponse(response, trimmed);
          maybeSummarize();
        } catch (err) {
          handleAiError(err);
        } finally {
          get().setLoading(false);
        }
      },

      resolveSkillCheck: async (total, success) => {
        const pending = get().pendingRoll;
        if (!pending) return;
        // Race guard: if a fight started before the roll resolved, combat wins.
        if (get().combat?.active) {
          console.warn('[DM] combat active before roll outcome resolved — skipping AI roll outcome');
          get().clearPendingRoll();
          return;
        }
        get().clearPendingRoll();

        // Phase 10: apply onFail damage immediately (clamped) so it lands with
        // the dice result, before the AI narrates the outcome.
        if (!success && pending.onFailHpChange) {
          const c = get().character;
          if (c) {
            const hp = clampNarrativeHp(pending.onFailHpChange, c.maxHp);
            if (hp !== 0) {
              get().updateHp(hp);
              get().addNarrative(`💔 ${hp} HP`, 'combat');
            }
          }
          if (get().screen === 'game-over') return; // a fatal fall — no AI follow-up.
        }

        const ctx = buildContext();
        if (!ctx) return;

        get().setLoading(true);
        try {
          const response = await groqService.sendRollOutcome(
            pending.description,
            pending.stat,
            pending.dc,
            total,
            success,
            ctx,
            messageHistory.getHistory(),
          );
          messageHistory.addUserAction(`[ROLL: ${total} vs DC ${pending.dc} — ${success ? 'успех' : 'провал'}]`);
          messageHistory.addDMResponse(response);
          await applyDMResponse(response);
        } catch (err) {
          handleAiError(err);
        } finally {
          get().setLoading(false);
        }
      },
    };
  }),
);

// Dev-only console handle for debugging the AI integration (stripped from prod).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { useGameStore?: typeof useGameStore }).useGameStore = useGameStore;
}
