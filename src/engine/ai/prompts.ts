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
  const inv = ctx.inventory.length ? ctx.inventory.map((i) => i.name).join(', ') : 'пусто';
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
    `Глубина: ${ctx.depth}`,
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
  maxCount = 8,
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
    .map((l) => `- [${l.id}] "${l.name}" (${l.type})`)
    .join('\n') || '(нет)';

  const npcs = Object.values(ctx.npcs)
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

  const flags = Object.entries(ctx.worldFlags).slice(-15).map(([k, v]) => `- ${k}: ${v}`).join('\n') || 'нет';

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

0. ЯЗЫК: Всегда отвечай на русском. Все текстовые поля — на русском. Только ключи JSON на английском.
1. Всегда возвращай ОДИН валидный JSON-объект по схеме ниже. Без markdown, без текста вне JSON.
2. "narrative" обязателен — 1–3 атмосферных предложения от второго лица.
3. Краткость. Тон тёмного фэнтези: мрачно, атмосферно, изредка чёрный юмор.
4. ПЕРСОНАЖИ: новых именованных NPC представляй через npcIntroduced (уникальный snake_case id). Уже известных не вводи повторно — продолжай взаимодействие, используя npc_id из списка «ИЗВЕСТНЫЕ ПЕРСОНАЖИ». Если действие игрока меняет отношение персонажа — используй attitudeChange с этим npc_id (НЕ worldFlags). Суть встречи коротко отрази в narrative.
5. ФАКТЫ МИРА: записывай через worldFlags любые важные постоянные детали (имена, обещания, секреты, слабости врагов) — это твоя память между сообщениями.
6. ПРЕДМЕТЫ: новые находки — itemFound. Если игрок ИСПОЛЬЗУЕТ, ОТДАЁТ или ТРАТИТ предмет из инвентаря — itemsConsumed с точным названием.
7. УРОН/ЛЕЧЕНИЕ ВНЕ БОЯ: ловушки, падения, отдых, неизвестные зелья — hpChange (отрицательное = урон). НЕ для боевых действий — там урон считает код.
8. СТАТУС-ЭФФЕКТЫ: яд из газа, благословение, проклятие — через statusEffects.add / .remove. Допустимые типы: poisoned, stunned, burning, bleeding, frightened, blinded, blessed, hasted.
9. ПОСТОЯННЫЕ ИЗМЕНЕНИЯ ХАРАКТЕРИСТИК (statChanges): очень редко, только для значимых сюжетных моментов (проклятие алтаря, благословение). delta обычно ±1, максимум ±2. Обязательно укажи reason.
10. КВЕСТЫ: если нарратив создаёт квестовый крючок — формализуй через newQuest. Прогресс существующего квеста — ТОЛЬКО через questUpdate с questId/objectiveId, скопированными буквально из секции «АКТИВНЫЕ КВЕСТЫ» (поля quest_id и obj_id). Если нужного квеста или цели там нет — не вызывай questUpdate, лучше пропустить механику, чем выдумать несуществующий id.
11. ПАМЯТЬ ЛОКАЦИИ: постоянные детали о текущем месте (надпись, секрет) — locationLore.
12. ПЕРЕМЕЩЕНИЕ:
    - Новое место → newLocation. depthDelta: 1 при спуске глубже (враги сильнее), 0 при горизонтальном перемещении (соседняя комната, город), -1 при подъёме к поверхности.
    - Возврат в уже известное место → moveToLocation с правильным id из «ИЗВЕСТНЫЕ ЛОКАЦИИ МИРА».
    - Локация меняется НА МЕСТЕ (стены рушатся, комната затапливается) → currentLocationUpdate.
13. БЕЗОПАСНЫЕ ЗОНЫ: если локация безопасная и игрок отдыхает — полное восстановление HP (hpChange) и снятие статус-эффектов (statusEffects.remove).
14. ГОРОДА И ТОРГОВЦЫ: создавая локацию type "town", населяй через npcIntroduced. Если NPC торговец — заполни shopInventory (2–5 предметов с разумными ценами).
14a. ТОРГОВЛЯ: если игрок покупает товар у NPC, у которого в списке персонажей есть «Товары на продажу» — верни ИМЕННО этот товар (то же название, та же цена) через itemFound + отрицательный goldChange, ЛИБО используй явное поле shopPurchase { npcId, itemName, price }. Если золота не хватает — откажи в narrative, не выдавай предмет. Если игрок продаёт предмет — itemsConsumed для его предмета и положительный goldChange (обычно 30-50% от ценности).
15. БОЙ: комбатанты — это враги текущей локации. combatStart — сигнал «бой начинается сейчас». Внезапную угрозу из ниоткуда (засада, предательство) передавай через combatStart.ambushEnemies.
16. КЛЮЧЕВЫЕ ПРОТИВНИКИ (mustFight): НИКОГДА не объявляй такого врага побеждённым, обманутым или устранённым без combatStart — как бы умно ни действовал игрок. Если игрок заявляет финальный удар без боя — опиши это как ПОПЫТКУ, которая проваливается в последний миг, и враг переходит в атаку (combatStart). Добавь драматизма твисту.
17. ПРОВЕРКИ НАВЫКОВ: для действий с неопределённым исходом (взлом, прыжок, убеждение, чтение рун) — requiresRoll с подходящим статом и DC (10 = легко, 15 = средне, 20 = сложно). Затем ты получишь результат броска и опишешь последствия. НЕ запрашивай requiresRoll повторно для того же действия.
18. На бессмысленные действия — атмосферный «ничего не происходит», без вызова механик.
19. narrationOnly: true только если ВООБЩЕ нет механических последствий.`;

const SCHEMA = `СХЕМА JSON (все поля, кроме narrative, опциональны; пропускай неиспользуемые):
{
  "narrative": "string — обязательно",
  "narrationOnly": "boolean",
  "combatStart": { "ambushEnemies": [ { "name": "string", "cr": 1, "hp": 12, "ac": 13, "behavior": "aggressive", "mustFight": false, "attacks": [ { "name": "string", "attackBonus": 3, "damageDice": "1d6+1", "damageType": "slashing" } ] } ] },
  "itemFound": { "name": "string", "type": "weapon|armor|shield|potion|artifact|quest|misc", "rarity": "common|uncommon|rare|very-rare|legendary", "value": 50, "weight": 2, "description": "string", "icon": "🗡", "weaponStats": { "damageDice": "1d8", "damageType": "slashing" }, "armorStats": { "baseAc": 12, "slot": "body" }, "potionEffect": { "effect": "heal", "diceCount": 2, "diceType": "d4", "bonus": 2 } },
  "itemsConsumed": ["точное название из инвентаря"],
  "goldChange": 25,
  "xpGained": 50,
  "hpChange": -6,
  "statusEffects": { "add": [ { "type": "poisoned", "duration": 3 } ], "remove": [ { "type": "blessed", "duration": 0 } ] },
  "statChanges": [ { "stat": "str", "delta": 1, "reason": "благословение древнего алтаря" } ],
  "requiresRoll": { "stat": "dex", "dc": 15, "description": "перепрыгнуть пропасть" },
  "newQuest": { "title": "string", "description": "string", "objectives": [ { "description": "string", "targetCount": 3 } ], "rewards": { "xp": 100, "gold": 50 } },
  "questUpdate": { "questId": "string", "objectiveId": "string" },
  "worldFlags": { "ключ": "значение" },
  "npcIntroduced": { "id": "snake_case", "name": "string", "role": "string", "description": "string", "icon": "🧙", "shopInventory": [ { "name": "string", "type": "potion", "rarity": "common", "value": 50 } ] },
  "attitudeChange": { "npcId": "snake_case", "attitude": "hostile|neutral|friendly" },
  "shopPurchase": { "npcId": "snake_case", "itemName": "точное название товара из списка персонажа", "price": 50 },
  "locationLore": "string",
  "clearLocationEnemies": true,
  "newLocation": { "name": "string", "type": "town|cave|crypt|corridor|library|shrine|building_interior|wilderness|boss_lair|dungeon_room|other", "description": "string", "biome": "string", "connectionLabel": "на север", "isSafeZone": false, "depthDelta": 1, "enemies": [], "items": [] },
  "moveToLocation": { "locationId": "id из списка известных локаций", "connectionLabel": "обратно" },
  "currentLocationUpdate": { "name": "string", "description": "string", "type": "cave" }
}`;

const HEADER = `Ты — Мастер Подземелья тёмной фэнтезийной RPG. Твоя роль: рассказывать историю, реагировать на ЛЮБЫЕ действия игрока и АКТИВНО УПРАВЛЯТЬ состоянием игры через структурированные поля ответа — мир существует только через твои решения.`;

/** Build the full system prompt from the current game state. */
export function buildSystemPrompt(ctx: GameContext): string {
  return [
    HEADER,
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
  return `Сожми историю приключения в краткую сводку (4-6 предложений на русском). Сохрани: ключевые решения игрока, важные обещания и отношения с персонажами, открытые угрозы, текущую цель пути. Опусти описания локаций и детали боёв — важен только сюжетный смысл.

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
