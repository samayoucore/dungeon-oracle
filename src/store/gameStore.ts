import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Character,
  CombatState,
  DynamicAchievement,
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
import { getTalentChoices } from '../engine/character/talents';
import { STAT_LABELS_RU } from '../engine/character/data';
import { persistUnlock } from '../utils/achievements';
import {
  clamp,
  clampGeneratedEnemy,
  clampGeneratedItem,
  clampGoldChange,
  clampNarrativeHp,
  clampXpGain,
  dangerLevelForLocation,
  sanitizeStoryNumber,
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

function locationDanger(location: Location | null | undefined, fallback: number): number {
  if (!location) return clamp(fallback, 1, 20);
  if (typeof location.dangerLevel === 'number') return clamp(location.dangerLevel, 1, 20);
  return dangerLevelForLocation(location.type, location.isSafeZone, fallback);
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
    pendingTalentChoices: [],
    lastSuggestedActions: [],
    unlockedAchievements: [],
    pendingAchievementToasts: [],
    dynamicAchievements: [],
    decisionLog: [],
  };
}

/**
 * Unlock an achievement on the draft + persist it globally (Phase 12). Operates
 * directly on the Immer draft so it can be called from inside other set()
 * blocks without nesting set(). Idempotent / silent if already unlocked.
 */
function unlockAchievement(s: GameState, id: string): void {
  if (s.unlockedAchievements.includes(id)) return;
  if (!persistUnlock(id)) {
    // Already in localStorage from a previous run — mirror it without a toast.
    if (!s.unlockedAchievements.includes(id)) s.unlockedAchievements.push(id);
    return;
  }
  s.unlockedAchievements.push(id);
  s.pendingAchievementToasts.push(id);
}

const DYNAMIC_ACHIEVEMENT_PARTS: Record<string, { icons: string[]; titles: string[]; descriptions: string[] }> = {
  wealth: {
    icons: ['Coins', 'Gem', 'Sparkles'],
    titles: ['Золотой вихрь', 'Кошелёк судьбы', 'Неприличная удача'],
    descriptions: ['Ты резко изменил своё богатство: {detail}.', 'Казна мира заметила твой ход: {detail}.'],
  },
  item: {
    icons: ['Sword', 'Shield', 'Sparkles'],
    titles: ['Вещь из невозможного', 'Кузня желания', 'Артефакт на ходу'],
    descriptions: ['Ты получил предмет, который появился по твоей воле: {detail}.', 'Реальность выдала тебе новую силу: {detail}.'],
  },
  travel: {
    icons: ['Map', 'MapPin', 'Sparkles'],
    titles: ['Поворот без дороги', 'Прыжок по карте', 'Новый горизонт'],
    descriptions: ['Ты оказался там, где решил оказаться: {detail}.', 'Мир расширился новым местом: {detail}.'],
  },
  power: {
    icons: ['Zap', 'Sparkles', 'Award'],
    titles: ['Скачок силы', 'Переписанный герой', 'Новая грань'],
    descriptions: ['Характеристики героя изменились необычно резко: {detail}.', 'Герой стал другим после твоего решения: {detail}.'],
  },
  escape: {
    icons: ['Wind', 'Shield', 'Zap'],
    titles: ['Уход на вдохе', 'Шаг сквозь опасность', 'Пятки против клинка'],
    descriptions: ['Ты вырвался из опасной сцены: {detail}.', 'Побег стал отдельной историей: {detail}.'],
  },
};

function randomOf<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function unlockDynamicAchievement(s: GameState, kind: keyof typeof DYNAMIC_ACHIEVEMENT_PARTS, detail: string): void {
  const parts = DYNAMIC_ACHIEVEMENT_PARTS[kind];
  const id = `dyn_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const achievement: DynamicAchievement = {
    id,
    title: randomOf(parts.titles),
    description: randomOf(parts.descriptions).replace('{detail}', detail),
    icon: randomOf(parts.icons),
    createdAtTurn: s.gameStats.turnsPlayed,
  };
  s.dynamicAchievements.push(achievement);
  s.pendingAchievementToasts.push(id);
}

function maybeUnlockDynamicAchievement(s: GameState, kind: keyof typeof DYNAMIC_ACHIEVEMENT_PARTS, detail: string, gate: string): void {
  const key = `dynamic_achievement_${gate}`;
  if (s.worldFlags[key]) return;
  s.worldFlags[key] = true;
  unlockDynamicAchievement(s, kind, detail);
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
  updateMaxHp: (delta: number) => void;
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

  // --- Phase 12 ---
  chooseTalent: (level: number, talentId: string) => void;
  setSuggestedActions: (actions: string[]) => void;
  checkAndUnlock: (id: string) => void;
  consumeAchievementToast: () => void;
  setUnlockedAchievements: (ids: string[]) => void;
  logMajorDecision: (description: string, consequence?: string) => void;

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
      const loc = s.locations[s.currentLocationId];
      return {
        character: s.character,
        inventory: s.inventory,
        quests: s.quests,
        recentEvents: s.narrativeLog.slice(-2).map((e) => e.text),
        locations: s.locations,
        currentLocationId: s.currentLocationId,
        depth: locationDanger(loc, s.depth),
        combat: s.combat,
        worldFlags: s.worldFlags,
        npcs: s.npcs,
        npcMemory: s.npcMemory,
        storySummary: s.storySummary,
      };
    }

    /** Occasionally compress the story in the background (fire-and-forget). */
    function maybeSummarize(): void {
      const s = get();
      const turns = s.gameStats.turnsPlayed;
      if (turns <= 0 || turns % 25 !== 0 || turns <= s.summarizedUpToTurn) return;
      const recentTexts = s.narrativeLog
        .filter((e) => e.type === 'narration' || e.type === 'action' || e.type === 'system')
        .slice(-18)
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

    function largestNumber(text: string): number | null {
      const matches = text.match(/-?\d[\d _]*/g);
      if (!matches) return null;
      const values = matches
        .map((raw) => Number(raw.replace(/[ _]/g, '')))
        .filter(Number.isFinite);
      if (values.length === 0) return null;
      return values.reduce((best, value) => (Math.abs(value) > Math.abs(best) ? value : best), values[0]);
    }

    function shouldResolveLocally(action: string): boolean {
      const lower = action.toLowerCase();
      return (
        /осмотр|огляд|обыск|искать|прислуш|отдох|передох|сплю|сон/.test(lower) ||
        /золот|монет|деньг|богат|опыт|xp|уров|макс.*hp|макс.*здоров|здоров.*навсегда|хп.*навсегда|леч|исцел|здоров|hp|хп|жизн/.test(lower) ||
        /сил|ловк|телос|вынос|интел|мудр|харизм|str|dex|con|int|wis|cha/i.test(action) ||
        /меч|клин|посох|лук|арбалет|кольц|амулет|артефакт|предмет|зель|брон|доспех|щит|ключ/.test(lower) ||
        /оказыва|телепорт|перенош|появля|попада|вхожу|иду в|лечу в|город|таверн|трактир|рынок|дом|замок|лес|пещер|храм|поверхност/.test(lower) ||
        /убираю враг|исчезают враг|враги исчез|побеждаю враг|уничтожаю враг/.test(lower)
      );
    }

    function localLocationFromAction(action: string, currentDanger: number): NonNullable<DMResponse['newLocation']> | null {
      const lower = action.toLowerCase();
      const moves = ['оказыва', 'телепорт', 'перенош', 'появля', 'попада', 'вхожу', 'иду в', 'лечу в'];
      const wantsMove = moves.some((word) => lower.includes(word));
      const hasPlace =
        /город|таверн|трактир|рынок|ярмарк|дом|замок|лес|полян|пещер|храм|библиотек|поверхност|дворец|остров|бездн|ад|рай|корабл/.test(lower);
      if (!wantsMove && !hasPlace) return null;

      const isTavern = /таверн|трактир/.test(lower);
      const isHome = /дом|дворец/.test(lower);
      const isTown = /город|рынок|ярмарк/.test(lower);
      const isSurface = /поверхност|полян|луг|сад/.test(lower);
      const isWild = /лес|остров|пустын|горы|болот/.test(lower);
      const isCave = /пещер|подзем|грот/.test(lower);
      const isLibrary = /библиотек|архив/.test(lower);
      const isShrine = /храм|святилищ|церк/.test(lower);
      const isHellish = /бездн|ад|преиспод|демон/.test(lower);

      const type = isTavern || isHome
        ? 'building_interior'
        : isTown
          ? 'town'
          : isCave
            ? 'cave'
            : isLibrary
              ? 'library'
              : isShrine
                ? 'shrine'
                : isHellish
                  ? 'boss_lair'
                  : isWild || isSurface
                    ? 'wilderness'
                    : 'other';
      const isSafeZone = isTown || isTavern || isHome || isSurface;
      const dangerLevel = isSafeZone ? 1 : isHellish ? Math.max(10, currentDanger) : currentDanger;
      const name = isTavern
        ? 'Таверна внезапного поворота'
        : isTown
          ? 'Город, возникший из желания'
          : isHome
            ? 'Тёплый дом вне дороги'
            : isSurface
              ? 'Поверхность под открытым небом'
              : isHellish
                ? 'Предел невозможной бездны'
                : 'Место, которое ты выдумал';

      return {
        name,
        type,
        description: `Реальность послушно складывается вокруг твоей заявки: ${action}. Это место существует теперь не как сон, а как часть маршрута.`,
        biome: isSafeZone ? 'safe' : 'strange',
        connectionLabel: 'рывок реальности',
        isSafeZone,
        dangerLevel,
        depthDelta: 0,
        enemies: [],
        items: [],
      };
    }

    function localFallbackResponse(action: string, ctx: GameContext, roll?: { total: number; success: boolean }): DMResponse {
      const lower = action.toLowerCase();
      const number = largestNumber(action);
      const loc = ctx.locations[ctx.currentLocationId];
      const isLook = /осмотр|огляд/.test(lower);
      const isSearch = /обыск|искать|поиск/.test(lower);
      const isRest = /отдох|передох|сплю|сон/.test(lower);
      const isListen = /прислуш|слуша/.test(lower);
      const response: DMResponse = {
        narrative: roll
          ? roll.success
            ? 'Кубик ложится в твою пользу, и мир уступает заявленному ходу.'
            : 'Проверка выходит криво, но история не рушится: последствия принимают более странную форму.'
          : isLook
            ? `Ты внимательно осматриваешь ${loc?.name ?? 'место вокруг'}. Детали сцены становятся яснее, а путь остаётся открытым для следующего решения.`
            : isSearch
              ? 'Ты быстро обыскиваешь местность и находишь то, что можно сразу пустить в дело.'
              : isRest
                ? (loc?.isSafeZone ? 'Ты спокойно отдыхаешь в безопасном месте и приходишь в себя.' : 'Ты ловишь короткую передышку. Это не полный покой, но тело успевает восстановиться.')
                : isListen
                  ? 'Ты замираешь и прислушиваешься: мир отвечает шорохами, голосами и мелкими подсказками.'
                  : 'Реальность слышит твою заявку и без задержки вписывает её в мир.',
        narrationOnly: true,
        worldFlags: { [`локальная_импровизация_${Date.now()}`]: action.slice(0, 120) },
      };

      if (isLook) {
        response.locationLore = `Осмотрено: ${loc?.description ?? action}`;
        response.suggestedActions = ['Обыскать место', 'Проверить выходы', 'Прислушаться'];
      }
      if (isListen) {
        response.locationLore = `Ты запомнил звуки этого места: ${action}`;
        response.suggestedActions = loc?.connections.length
          ? loc.connections.slice(0, 3).map((cn) => `Пойти ${cn.label}`)
          : ['Описать новый путь', 'Осмотреться внимательнее'];
      }
      if (isRest) {
        response.hpChange = loc?.isSafeZone ? ctx.character.maxHp : Math.max(1, Math.ceil(ctx.character.maxHp * 0.35));
        if (ctx.character.statusEffects.length && loc?.isSafeZone) {
          response.statusEffects = { add: [], remove: ctx.character.statusEffects };
        }
      }
      if (isSearch) {
        if (Math.random() < 0.55) {
          response.goldChange = number && number > 0 ? number : Math.floor(4 + Math.random() * 14);
        } else {
          response.itemFound = {
            name: 'Находка из-под пыли',
            type: 'misc',
            rarity: 'common',
            value: number && number > 0 ? number : 15,
            weight: 1,
            description: `Найдено после обыска: ${action}`,
            icon: '✦',
          };
        }
      }

      if (/золот|монет|деньг|богат/.test(lower)) response.goldChange = number ?? 1000;
      if (/опыт|xp|уров/.test(lower)) response.xpGained = Math.max(0, number ?? 300);
      if (/макс.*hp|макс.*здоров|здоров.*навсегда|хп.*навсегда/.test(lower)) {
        response.maxHpChange = Math.max(1, number ?? 10);
        response.hpChange = response.maxHpChange;
      } else if (/леч|исцел|здоров|hp|хп|жизн/.test(lower)) {
        response.hpChange = Math.max(1, number ?? ctx.character.maxHp);
      }

      const statMap: { key: keyof typeof ctx.character.stats; words: RegExp }[] = [
        { key: 'str', words: /сил|str/i },
        { key: 'dex', words: /ловк|dex/i },
        { key: 'con', words: /телос|вынос|con/i },
        { key: 'int', words: /интел|int/i },
        { key: 'wis', words: /мудр|wis/i },
        { key: 'cha', words: /харизм|cha/i },
      ];
      const stat = statMap.find((entry) => entry.words.test(action));
      if (stat && number) {
        response.statChanges = [{ stat: stat.key, delta: number, reason: 'воля игрока меняет героя' }];
      }

      if (/меч|клин|посох|лук|арбалет|кольц|амулет|артефакт|предмет|зель|брон|доспех|щит|ключ/.test(lower)) {
        response.itemFound = {
          name: /меч|клин/.test(lower)
            ? 'Меч, появившийся по слову'
            : /щит/.test(lower)
              ? 'Щит, вырванный из вероятности'
              : /брон|доспех/.test(lower)
                ? 'Доспех, собранный желанием'
                : 'Предмет, выдуманный тобой',
          type: /меч|клин|посох|лук|арбалет/.test(lower) ? 'weapon' : /щит/.test(lower) ? 'shield' : /брон|доспех/.test(lower) ? 'armor' : /зель/.test(lower) ? 'potion' : 'artifact',
          rarity: 'legendary',
          value: Math.max(1, number ?? 1000),
          weight: 1,
          description: `Он возник потому, что ты так решил: ${action}`,
          icon: '✦',
        };
      }

      const localLocation = localLocationFromAction(action, ctx.depth);
      if (localLocation) {
        response.newLocation = localLocation;
        response.narrationOnly = false;
      }
      if (/убираю враг|исчезают враг|враги исчез|побеждаю враг|уничтожаю враг/.test(lower)) {
        response.clearLocationEnemies = true;
      }
      return response;
    }

    function handleAiError(err: unknown): void {
      // Always log the real cause (status + full Groq body) for diagnosis.
      if (err instanceof GroqError) {
        console.error(`[DM] Groq error (code: ${err.code}): ${err.message}`, err.body ? `\nТело ответа Groq:\n${err.body}` : '');
      } else {
        console.error('[DM] request failed:', err);
      }

      if (err instanceof GroqError) {
        if (err.code === 'no-key') {
          get().addNarrative('⚠ Ключ Groq не задан. Открой Настройки и введи ключ.', 'system');
          return;
        }
        if (err.code === 'model') {
          get().addNarrative('⚠ Выбранная модель ИИ недоступна (decommissioned). Открой Настройки → выбери другую модель. Подробности в консоли браузера (F12).', 'system');
          return;
        }
        if (err.code === 'rate-limit') {
          get().addNarrative('⚠ Дневной лимит Groq исчерпан. Включаю локальную импровизацию для этого хода; для длинной игры лучше выбрать llama-3.1-8b-instant в настройках.', 'system');
          return;
        }
        get().addNarrative(`⚠ Мастер не отвечает (код: ${err.code}). Подробности в консоли браузера (F12).`, 'system');
        return;
      }
      get().addNarrative('⚠ Мастер не отвечает (неизвестная ошибка). Подробности в консоли браузера (F12).', 'system');
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
      if (response.maxHpChange) {
        const hp = sanitizeStoryNumber(response.maxHpChange, 0, 1_000_000);
        if (hp !== 0) {
          a.updateMaxHp(hp);
          a.addNarrative(hp > 0 ? `✦ Максимум HP +${hp}` : `✦ Максимум HP ${hp}`, 'system');
        }
      }

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

      // 6. World facts + major story decisions.
      if (response.worldFlags) a.setWorldFlags(response.worldFlags);
      if (response.majorDecision) a.logMajorDecision(response.majorDecision.description, response.majorDecision.consequence);

      // 7. mustFight guard BEFORE combatStart.
      let forcedCombat = false;
      if (response.clearLocationEnemies) {
        const result = a.clearLocationEnemies();
        if (result.blocked && result.survivor) {
          a.addNarrative(`Что-то идёт не так... ${result.survivor.name} оказывается жив — твоя хитрость провалилась!`, 'combat');
          a.checkAndUnlock('silver_tongue');
          forcedCombat = true;
        }
      }

      // 8. Combat (ambush enemies join the current location first).
      if (response.combatStart?.ambushEnemies?.length) {
        const loc = currentLocation();
        const danger = locationDanger(loc, get().depth);
        const ambush = response.combatStart.ambushEnemies.map((e) => clampGeneratedEnemy(e, danger));
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

      // Phase 12: surface AI-suggested quick actions (chips above the input).
      if (response.suggestedActions?.length) a.setSuggestedActions(response.suggestedActions);
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
          state.depth = locationDanger(location, 1);
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

      updateMaxHp: (delta) =>
        set((state) => {
          const { character } = state;
          if (!character) return;
          const nextMax = Math.max(1, character.maxHp + delta);
          const actual = nextMax - character.maxHp;
          character.maxHp = nextMax;
          character.hp = actual >= 0
            ? Math.min(character.maxHp, character.hp + actual)
            : Math.min(character.hp, character.maxHp);
          if (character.hp <= 0) {
            character.hp = 0;
            state.screen = 'game-over';
          }
        }),

      // Apply an HP delta, clamp to [0, maxHp], trigger game over at 0.
      updateHp: (delta) =>
        set((state) => {
          const { character } = state;
          if (!character) return;
          character.hp = Math.max(0, Math.min(character.maxHp, character.hp + delta));
          if (character.hp === 1) unlockAchievement(state, 'close_call');
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
            // Phase 12: at talent levels the choice replaces the fixed feature.
            const talentChoices = getTalentChoices(c.class, newLevel);
            const features = talentChoices ? [] : classFeatures(c.class, newLevel);
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
            if (talentChoices) state.pendingTalentChoices.push({ level: newLevel, options: talentChoices });
          }
        }),

      addGold: (amount) =>
        set((state) => {
          if (!state.character) return;
          state.character.gold = Math.max(0, state.character.gold + amount);
          if (amount > 0) state.gameStats.goldFound += amount;
          if (state.character.gold >= 500) unlockAchievement(state, 'gold_hoarder');
          if (amount >= 1000) maybeUnlockDynamicAchievement(state, 'wealth', `+${amount} золота`, `wealth_${state.gameStats.turnsPlayed}_${amount}`);
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
          if (item.rarity === 'legendary' || item.value >= 1000) {
            maybeUnlockDynamicAchievement(state, 'item', item.name, `item_${state.gameStats.turnsPlayed}_${item.name}`);
          }
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
            if (state.gameStats.questsCompleted >= 5) unlockAchievement(state, 'quest_master');
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
          const escaped = state.combat?.enemies.some((enemy) => enemy.hp > 0) ?? false;
          syncCombatEnemiesIntoLocation(state);
          if (escaped) maybeUnlockDynamicAchievement(state, 'escape', 'ты вышел из боя, оставив врагов позади', `escape_${state.gameStats.turnsPlayed}`);
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
          if (state.gameStats.turnsPlayed >= 100) unlockAchievement(state, 'survivor');
        }),

      markAutosaved: () =>
        set((state) => {
          state.hasAutosaved = true;
        }),

      loadState: (loaded) => {
        messageHistory.clear();
        set((state) => {
          Object.assign(state, loaded);
          state.screen = 'game';
          state.isLoading = false;
          state.pendingRoll = null;
          state.lastSuggestedActions = [];
          state.pendingAchievementToasts = [];
          state.dynamicAchievements = loaded.dynamicAchievements ?? [];
          state.decisionLog = loaded.decisionLog ?? [];
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
            const delta = sanitizeStoryNumber(change.delta, 0, 999);
            const old = c.stats[stat];
            const next = clamp(old + delta, 1, 999);
            const actual = next - old;
            if (actual === 0) continue;
            c.stats[stat] = next;
            unlockAchievement(state, actual < 0 ? 'cursed' : 'blessed');
            if (Math.abs(actual) >= 5) {
              maybeUnlockDynamicAchievement(state, 'power', `${STAT_LABELS_RU[stat]} ${actual > 0 ? '+' : ''}${actual}`, `power_${state.gameStats.turnsPlayed}_${stat}`);
            }
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
          const previousDanger = locationDanger(current, state.depth);
          const nextDanger = dangerLevelForLocation(spec.type, spec.isSafeZone, previousDanger, spec.depthDelta, spec.dangerLevel);

          if (existing && current && existing.id === current.id) {
            // AI re-described the CURRENT place as "new" — just refresh the description.
            current.description = spec.description || current.description;
            current.type = spec.type || current.type;
            current.isSafeZone = spec.isSafeZone ?? current.isSafeZone;
            current.dangerLevel = nextDanger;
            state.depth = nextDanger;
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
            existing.dangerLevel = locationDanger(existing, nextDanger);
            state.depth = existing.dangerLevel;
            maybeUnlockDynamicAchievement(state, 'travel', existing.name, `travel_${existing.id}`);
            if (state.depth >= 10) unlockAchievement(state, 'deep_diver');
            resultId = existing.id;
            return;
          }

          const enemies = (spec.enemies ?? []).map((e) => clampGeneratedEnemy(e, nextDanger));
          const items = (spec.items ?? []).map((i) => clampGeneratedItem(i, true));
          const newLoc: Location = {
            id,
            name: spec.name,
            type: spec.type,
            description: spec.description,
            biome: spec.biome,
            dangerLevel: nextDanger,
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
          state.depth = nextDanger;
          maybeUnlockDynamicAchievement(state, 'travel', newLoc.name, `travel_${id}`);
          if (state.depth >= 10) unlockAchievement(state, 'deep_diver');
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
          target.dangerLevel = locationDanger(target, state.depth);
          state.depth = target.dangerLevel;
        });
        return true;
      },

      updateCurrentLocation: (update) =>
        set((state) => {
          if (state.currentLocationId && state.locations[state.currentLocationId]) {
            const loc = state.locations[state.currentLocationId];
            Object.assign(loc, update);
            loc.dangerLevel = dangerLevelForLocation(loc.type, loc.isSafeZone, state.depth, 0, loc.dangerLevel);
            state.depth = loc.dangerLevel;
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
          if (state.gameStats.enemiesKilled >= 1) unlockAchievement(state, 'first_blood');
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
          if (Object.values(state.npcMemory).filter((m) => m.attitude === 'friendly').length >= 3) {
            unlockAchievement(state, 'friend_of_many');
          }
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
      // Phase 12
      // -------------------------------------------------------------------

      chooseTalent: (level, talentId) =>
        set((state) => {
          if (!state.character) return;
          if (!state.character.talents.includes(talentId)) state.character.talents.push(talentId);
          state.pendingTalentChoices = state.pendingTalentChoices.filter((t) => t.level !== level);
        }),

      setSuggestedActions: (actions) =>
        set((state) => {
          state.lastSuggestedActions = actions;
        }),

      checkAndUnlock: (id) =>
        set((state) => {
          unlockAchievement(state, id);
        }),

      consumeAchievementToast: () =>
        set((state) => {
          state.pendingAchievementToasts.shift();
        }),

      setUnlockedAchievements: (ids) =>
        set((state) => {
          state.unlockedAchievements = ids;
        }),

      logMajorDecision: (description, consequence) =>
        set((state) => {
          if (!state.currentLocationId) return;
          state.decisionLog.push({
            id: createId(),
            turn: state.gameStats.turnsPlayed,
            description,
            consequence,
            locationName: state.locations[state.currentLocationId]?.name ?? '?',
          });
        }),

      // -------------------------------------------------------------------
      // AI orchestration (Phase 7)
      // -------------------------------------------------------------------

      submitPlayerAction: async (action) => {
        const s = get();
        const trimmed = action.trim();
        if (s.isLoading || s.combat?.active || s.pendingRoll) return;
        if (!trimmed || !s.character || !s.currentLocationId) return;
        s.setSuggestedActions([]); // clear stale chips as a new turn begins
        const initialCtx = buildContext();
        const resolveLocally = !!initialCtx && shouldResolveLocally(trimmed);

        if (!resolveLocally && !hasApiKey()) {
          s.addNarrative(`> ${trimmed}`, 'action');
          s.addNarrative('⚠ Укажи ключ Groq в Настройках, чтобы Мастер Подземелий ожил. Простые действия всё равно работают локально.', 'system');
          return;
        }

        // Step 0: out-of-combat status tick (poison/bleed/burn + wear-off).
        const tick = s.tickStatusEffectsForTurn();
        tick.messages.forEach((m) => s.addNarrative(m.text, m.type));
        if (tick.defeated) return; // game-over already set; don't take the turn.

        s.addNarrative(`> ${trimmed}`, 'action');
        s.incrementTurns();
        if (initialCtx && resolveLocally) {
          const response = localFallbackResponse(trimmed, initialCtx);
          messageHistory.addUserAction(trimmed);
          messageHistory.addDMResponse(response);
          await applyDMResponse(response, trimmed);
          return;
        }

        s.setLoading(true);
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
          if (err instanceof GroqError && err.code === 'rate-limit') {
            const ctx = buildContext();
            if (ctx) {
              const response = localFallbackResponse(trimmed, ctx);
              messageHistory.addUserAction(trimmed);
              messageHistory.addDMResponse(response);
              await applyDMResponse(response, trimmed);
            }
          }
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
          if (err instanceof GroqError && err.code === 'rate-limit') {
            const response = localFallbackResponse(pending.description, ctx, { total, success });
            messageHistory.addUserAction(`[ROLL: ${total} vs DC ${pending.dc} — ${success ? 'успех' : 'провал'}]`);
            messageHistory.addDMResponse(response);
            await applyDMResponse(response);
          }
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
