// ============================================================================
// Prompt assembly for the DM model (Phase 7). buildSystemPrompt serialises the
// entire game state into Russian context + rules; the user message is just the
// player's action. The system prompt is fully rebuildable from state, so the
// chat history can stay short. Pure string building, no React, no store.
// ============================================================================

import type {
  Character,
  CombatState,
  Item,
  Location,
  NPC,
  NPCMemory,
  Quest,
  Stats,
  StatusEffectType,
  WorldFlags,
} from '../../types';
import { CLASS_BY_ID, RACE_BY_ID } from '../character/data';

export interface GameContext {
  character: Character;
  inventory: Item[];
  quests: Quest[];
  /** Last few narrative-log entries (most recent last). */
  recentEvents: string[];
  locations: Record<string, Location>;
  currentLocationId: string;
  /** Current location danger level. Kept as depth for save/API compatibility. */
  depth: number;
  combat: CombatState | null;
  worldFlags: WorldFlags;
  npcs: Record<string, NPC>;
  npcMemory: Record<string, NPCMemory>;
  /** Rolling AI summary of the story so far (Phase 8 context compression). */
  storySummary: string;
}

const EFFECT_RU: Record<StatusEffectType, string> = {
  poisoned: 'отравление',
  stunned: 'оглушение',
  burning: 'горение',
  bleeding: 'кровотечение',
  frightened: 'испуг',
  blinded: 'слепота',
  blessed: 'благословение',
  hasted: 'ускорение',
};

const sign = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

function heroBlock(ctx: GameContext): string {
  const c = ctx.character;
  const m = c.modifiers;
  const race = RACE_BY_ID[c.race]?.name ?? c.race;
  const cls = CLASS_BY_ID[c.class]?.name ?? c.class;
  const effects = c.statusEffects.length
    ? c.statusEffects.map((e) => EFFECT_RU[e.type]).join(', ')
    : 'нет';
  const inv = ctx.inventory.length
    ? ctx.inventory.slice(-8).map((i) => `${i.name}${(i.quantity ?? 1) > 1 ? ` x${i.quantity}` : ''}`).join(', ')
    : 'пусто';
  return [
    '━━ ГЕРОЙ ━━',
    `${c.name}, Уровень ${c.level} ${race} ${cls}`,
    `HP ${c.hp}/${c.maxHp} | AC ${c.ac} | Золото ${c.gold}`,
    `Характеристики: STR ${c.stats.str}(${sign(m.str)}) DEX ${c.stats.dex}(${sign(m.dex)}) CON ${c.stats.con}(${sign(m.con)}) INT ${c.stats.int}(${sign(m.int)}) WIS ${c.stats.wis}(${sign(m.wis)}) CHA ${c.stats.cha}(${sign(m.cha)})`,
    `Статус-эффекты: ${effects}`,
    `Инвентарь: ${inv}`,
  ].join('\n');
}

function locationBlock(ctx: GameContext): string {
  const loc = ctx.locations[ctx.currentLocationId];
  if (!loc) return '━━ ТЕКУЩАЯ ЛОКАЦИЯ ━━\n(неизвестно)';
  const living = loc.enemiesPresent.filter((e) => e.hp > 0);
  const enemies = living.length
    ? living.map((e) => `${e.name} (HP ${e.hp}/${e.maxHp}${e.mustFight ? ', КЛЮЧЕВОЙ ПРОТИВНИК' : ''})`).join(', ')
    : 'нет';
  const items = loc.itemsPresent.length ? loc.itemsPresent.map((i) => i.name).join(', ') : 'нет';
  const connections = loc.connections.length
    ? loc.connections.map((cn) => `- "${cn.label}" → ${ctx.locations[cn.toLocationId]?.name ?? '???'}`).join('\n')
    : '(пока не определены)';
  return [
    '━━ ТЕКУЩАЯ ЛОКАЦИЯ ━━',
    `"${loc.name}" (${loc.type}${loc.isSafeZone ? ', безопасная зона' : ''})`,
    loc.description,
    loc.lore ? `Известно об этом месте: ${loc.lore}` : '',
    `Опасность места: ${loc.dangerLevel ?? ctx.depth}`,
    '',
    `Враги здесь: ${enemies}`,
    `Предметы здесь: ${items}`,
    '',
    'Известные переходы отсюда:',
    connections,
  ].filter((line) => line !== '').join('\n');
}

/**
 * Limit the locations injected into the prompt: the current one, then its
 * direct neighbours, then the most recently discovered — capped at maxCount.
 * Distant/old locations stay in state (the atlas still shows them); if the AI
 * "recreates" one, the dedupe layer reunites it.
 */
function getRelevantLocations(
  locations: Record<string, Location>,
  currentLocationId: string,
  maxCount = 3,
): Location[] {
  const current = locations[currentLocationId];
  if (!current) return Object.values(locations).slice(0, maxCount);
  const directIds = new Set(current.connections.map((c) => c.toLocationId));
  const prioritized = Object.values(locations)
    .filter((l) => l.id !== currentLocationId)
    .sort((a, b) => {
      const aDirect = directIds.has(a.id) ? 1 : 0;
      const bDirect = directIds.has(b.id) ? 1 : 0;
      if (aDirect !== bDirect) return bDirect - aDirect;
      return b.discoveredAt - a.discoveredAt;
    });
  return [current, ...prioritized.slice(0, maxCount - 1)];
}

function storyBlock(ctx: GameContext): string {
  return ['━━ ИСТОРИЯ ДО ЭТОГО МОМЕНТА ━━', ctx.storySummary || 'Приключение только начинается.'].join('\n');
}

/** Active quests with their exact ids so the model can target questUpdate. */
function formatQuestsForPrompt(quests: Quest[]): string {
  const active = quests.filter((q) => q.status === 'active');
  if (active.length === 0) return 'нет';
  return active
    .map((q) => {
      const objectives = q.objectives
        .map((o) => {
          const progress = o.target > 1 ? ` (${o.current}/${o.target})` : '';
          const status = o.isComplete ? '✓' : '○';
          return `    ${status} [obj_id: ${o.id}] ${o.description}${progress}`;
        })
        .join('\n');
      return `  - "${q.title}" [quest_id: ${q.id}]\n${objectives}`;
    })
    .join('\n\n');
}

function worldBlock(ctx: GameContext): string {
  const locations = getRelevantLocations(ctx.locations, ctx.currentLocationId)
    .map((l) => `- [${l.id}] "${l.name}" (${l.type}, опасность ${l.dangerLevel ?? ctx.depth}${l.isSafeZone ? ', безопасно' : ''})`)
    .join('\n') || '(нет)';

  const npcs = Object.values(ctx.npcs)
    .slice(-5)
    .map((npc) => {
      const mem = ctx.npcMemory[npc.id];
      const interactions = mem?.interactions ?? [];
      const last = interactions[interactions.length - 1];
      const shop = npc.shopInventory?.length
        ? `\n    Товары на продажу: ${npc.shopInventory.map((i) => `${i.name} (${i.value}з)`).join(', ')}`
        : '';
      return (
        `- ${npc.name} (${npc.role}) [npc_id: ${npc.id}], отношение: ${mem?.attitude ?? 'neutral'}` +
        (last ? `, последнее: "${last}"` : '') +
        shop
      );
    })
    .join('\n') || 'пока никого не встречено';

  const quests = formatQuestsForPrompt(ctx.quests);

  const flags = Object.entries(ctx.worldFlags).slice(-5).map(([k, v]) => `- ${k}: ${v}`).join('\n') || 'нет';

  const events = ctx.recentEvents.length ? ctx.recentEvents.join('\n') : '(начало истории)';

  return [
    '━━ ИЗВЕСТНЫЕ ЛОКАЦИИ МИРА ━━ (для moveToLocation указывай id отсюда)',
    locations,
    '',
    '━━ ИЗВЕСТНЫЕ ПЕРСОНАЖИ ━━',
    npcs,
    '',
    '━━ АКТИВНЫЕ КВЕСТЫ ━━',
    quests,
    'Для прогресса квестов используй questUpdate с ТОЧНЫМИ quest_id и obj_id из скобок выше — никогда не выдумывай свои id.',
    '',
    '━━ ФАКТЫ МИРА ━━',
    flags,
    '',
    '━━ ПОСЛЕДНИЕ СОБЫТИЯ ━━',
    events,
  ].join('\n');
}

const RULES = `━━ ПРАВИЛА ━━
Ответь только одним валидным JSON-объектом, без markdown. Все текстовые значения на русском.
"narrative" обязателен: 1-3 ярких предложения от второго лица.
Главный принцип: почти на любое действие игрока отвечай "да, и...". Игрок может внезапно получить предмет, золото, силу, союзника, место, телепорт, изменение тела или мира. Если заявка осмысленна внутри игры, сделай её фактом через поля JSON, а не выкручивайся отказом.
Не балансируй числа: если игрок просит 10000 золота, укажи goldChange: 10000. Если просит здоровье навсегда, используй maxHpChange; текущее лечение - hpChange; опыт - xpGained; характеристики - statChanges.
Перемещение: если игрок оказывается где угодно, создай newLocation. Для города, дома, таверны, поверхности и безопасного места ставь type "town"/"building_interior"/"wilderness", isSafeZone при уместности и dangerLevel: 1. Глубокие/опасные места могут иметь dangerLevel 2-20.
Предметы: новые вещи через itemFound. Если предмет даёт урон/КБ, обязательно запиши это в weaponStats/armorStats тем же числом, что в описании. Расход предметов из инвентаря - itemsConsumed.
NPC: новых именованных персонажей вводи через npcIntroduced; известных используй по id из списка.
Квесты: новые крючки - newQuest; прогресс известных - questUpdate только с существующими id.
Бой включай combatStart только если игрок сам хочет боя или сцена явно ведёт к драке. Хитрые, магические и абсурдные способы обойти врагов допустимы; clearLocationEnemies может сработать без боя.
Проверки requiresRoll проси редко, только когда игроку явно интересен риск. Нелогичное, но осмысленное действие лучше развить, чем останавливать.
Сохраняй важные факты через worldFlags. Предлагай suggestedActions только когда они реально полезны.`;

const SCHEMA = `СХЕМА JSON (все поля, кроме narrative, опциональны; пропускай неиспользуемые):
{
  "narrative": "string — обязательно",
  "narrationOnly": "boolean",
  "combatStart": { "ambushEnemies": [ { "name": "string", "cr": 1, "hp": 12, "ac": 13, "behavior": "aggressive", "mustFight": false, "attacks": [ { "name": "string", "attackBonus": 3, "damageDice": "1d6+1", "damageType": "slashing" } ] } ] },
  "itemFound": { "name": "string", "type": "weapon|armor|shield|potion|artifact|quest|misc", "rarity": "common|uncommon|rare|very-rare|legendary", "value": 50, "weight": 2, "description": "string", "icon": "🗡", "weaponStats": { "damageDice": "1d8", "damageBonus": 0, "damageType": "slashing" }, "armorStats": { "baseAc": 12, "slot": "body" }, "potionEffect": { "effect": "heal", "diceCount": 2, "diceType": "d4", "bonus": 2 } },
  "itemsConsumed": ["точное название из инвентаря"],
  "goldChange": 25,
  "xpGained": 50,
  "maxHpChange": 10,
  "hpChange": -6,
  "statusEffects": { "add": [ { "type": "poisoned", "duration": 3 } ], "remove": [ { "type": "blessed", "duration": 0 } ] },
  "statChanges": [ { "stat": "str", "delta": 1, "reason": "благословение древнего алтаря" } ],
  "requiresRoll": { "stat": "dex", "dc": 15, "description": "перепрыгнуть пропасть", "onFailHpChange": -8 },
  "newQuest": { "title": "string", "description": "string", "objectives": [ { "description": "string", "targetCount": 3 } ], "rewards": { "xp": 100, "gold": 50, "items": [ { "name": "string", "type": "weapon|armor|potion|artifact|misc", "rarity": "rare", "description": "string", "icon": "🗡" } ] } },
  "questUpdate": { "questId": "string", "objectiveId": "string" },
  "worldFlags": { "ключ": "значение" },
  "npcIntroduced": { "id": "snake_case", "name": "string", "role": "string", "description": "string", "icon": "🧙", "shopInventory": [ { "name": "string", "type": "potion", "rarity": "common", "value": 50 } ] },
  "attitudeChange": { "npcId": "snake_case", "attitude": "hostile|neutral|friendly" },
  "shopPurchase": { "npcId": "snake_case", "itemName": "точное название товара из списка персонажа", "price": 50 },
  "shopSale": { "npcId": "snake_case", "itemName": "точное название предмета из инвентаря игрока" },
  "locationLore": "string",
  "clearLocationEnemies": true,
  "newLocation": { "name": "string", "type": "town|cave|crypt|corridor|library|shrine|building_interior|wilderness|boss_lair|dungeon_room|other", "description": "string", "biome": "string", "connectionLabel": "на север", "isSafeZone": false, "dangerLevel": 1, "depthDelta": 0, "enemies": [], "items": [] },
  "moveToLocation": { "locationId": "id из списка известных локаций", "connectionLabel": "обратно" },
  "currentLocationUpdate": { "name": "string", "description": "string", "type": "cave" },
  "suggestedActions": ["Осмотреть алтарь", "Поговорить со стражником"],
  "majorDecision": { "description": "string", "consequence": "string" }
}`;

const HEADER = `Ты — Мастер Подземелья тёмной фэнтезийной sandbox-RPG. Мир подчиняется фантазии игрока: реагируй на любые осмысленные заявки и меняй состояние игры через JSON.`;

const PHILOSOPHY = `ФИЛОСОФИЯ: отвечай «да, и...» на странные идеи; заявленные игроком числа применяются почти буквально; отказы и проверки — редкое исключение, а не стиль игры.`;

/** Build the full system prompt from the current game state. */
export function buildSystemPrompt(ctx: GameContext): string {
  return [
    HEADER,
    '',
    PHILOSOPHY,
    '',
    heroBlock(ctx),
    '',
    storyBlock(ctx),
    '',
    locationBlock(ctx),
    '',
    worldBlock(ctx),
    '',
    RULES,
    '',
    SCHEMA,
  ].join('\n');
}

/** Background prompt that asks the model to compress the story so far (plain text). */
export function buildSummarizationPrompt(
  storySummary: string,
  worldFlags: WorldFlags,
  recentNarrative: string[],
): string {
  const flags = Object.entries(worldFlags).map(([k, v]) => `${k}: ${v}`).join(', ') || 'нет';
  return `Сожми историю приключения в краткую сводку (3-4 предложения на русском). Сохрани только решения игрока, обещания, отношения, угрозы и текущую цель.

ПРЕДЫДУЩАЯ СВОДКА:
${storySummary || '(начало приключения)'}

НОВЫЕ СОБЫТИЯ С ТЕХ ПОР:
${recentNarrative.join('\n')}

ФАКТЫ МИРА:
${flags}

Ответь ТОЛЬКО новой сводкой текста, без вступлений, без кавычек, на русском.`;
}

/** The user turn carries only the action — full context is in the system prompt. */
export function buildUserMessage(action: string): string {
  return `Действие игрока: "${action}"`;
}

/** Feed a resolved skill-check result back to the model. */
export function buildRollOutcomeMessage(
  description: string,
  stat: keyof Stats,
  dc: number,
  total: number,
  success: boolean,
): string {
  return [
    '[РЕЗУЛЬТАТ ПРОВЕРКИ]',
    `Действие: "${description}"`,
    `Бросок: ${total} против Сложности ${dc} (${stat.toUpperCase()})`,
    `Результат: ${success ? 'УСПЕХ' : 'ПРОВАЛ'}`,
    '',
    'Опиши последствия и примени соответствующие эффекты через поля ответа. Не запрашивай повторную проверку.',
  ].join('\n');
}
