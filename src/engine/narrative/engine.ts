// ============================================================================
// Narrative engine: assembles room descriptions and parses player commands.
// Pure functions (no React). Russian output; the command parser accepts both
// Russian and English keywords.
// ============================================================================

import type { Character, Item, Room } from '../../types';
import {
  ENEMY_SPOTTED_TEMPLATES,
  FLOOR_DETAIL,
  LIGHTING,
  LOW_HP_ATMOSPHERE,
  ROOM_SIZE,
  ROOM_TEMPLATES,
  SMELL,
  SOUND,
  UNKNOWN_ACTION_RESPONSES,
} from './templates';

const LOW_HP_THRESHOLD = 0.3;

/** Recognised command categories for the input parser. */
export type CommandKind = 'look' | 'search' | 'rest' | 'inventory' | 'stats' | 'attack' | 'unknown';

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Replace {placeholders} with values; leave unknown ones intact. */
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

/** Build a unique room description from templates + contextual variables. */
export function generateRoomDescription(room: Room, character: Character): string {
  let text = fill(pick(ROOM_TEMPLATES[room.type]), {
    size: pick(ROOM_SIZE),
    lighting: pick(LIGHTING),
    smell: pick(SMELL),
    sound: pick(SOUND),
    floor_detail: pick(FLOOR_DETAIL),
  });

  if (room.enemies.length > 0) {
    text += ` ${fill(pick(ENEMY_SPOTTED_TEMPLATES), { enemy: room.enemies[0].name })}`;
  }
  if (room.lore) {
    text += `\n\n${room.lore}`;
  }
  if (character.maxHp > 0 && character.hp / character.maxHp < LOW_HP_THRESHOLD) {
    text += `\n\n${pick(LOW_HP_ATMOSPHERE)}`;
  }
  return text;
}

/** Map free-text input to a command category (Russian + English keywords). */
export function classifyCommand(input: string): CommandKind {
  const text = input.toLowerCase();
  if (/атак|удар|бой|драть|сраж|attack|fight|strike|kill/.test(text)) return 'attack';
  if (/осмотр|огляд|изуч|смотр|look|examine|inspect/.test(text)) return 'look';
  if (/обыск|обшар|искать|ищу|loot|search/.test(text)) return 'search';
  if (/отдых|отдохн|привал|спать|сон|rest|sleep|camp/.test(text)) return 'rest';
  if (/инвентар|сумк|рюкзак|предмет|вещи|inventory|bag|items/.test(text)) return 'inventory';
  if (/стат|характеристик|персонаж|состоян|stats|status|character/.test(text)) return 'stats';
  return 'unknown';
}

/** HP recovered by a short rest: CON modifier + level, minimum 1. */
export function restHpAmount(character: Character): number {
  return Math.max(1, character.modifiers.con + character.level);
}

/**
 * Produce a narrative response to a player command.
 * (Inventory is passed explicitly since it lives outside the Character.)
 */
export function generateActionResponse(
  input: string,
  room: Room,
  character: Character,
  inventory: Item[],
): string {
  switch (classifyCommand(input)) {
    case 'look':
      return generateRoomDescription(room, character);
    case 'search':
      return room.items.length > 0
        ? `Ты обыскиваешь комнату и находишь: ${room.items.map((item) => item.name).join(', ')}.`
        : 'Ты тщательно всё обыскиваешь, но не находишь ничего ценного.';
    case 'rest':
      return room.enemies.length === 0
        ? `Ты ненадолго отдыхаешь. (восстановлено ${restHpAmount(character)} HP)`
        : 'Нельзя отдыхать, когда рядом враги.';
    case 'inventory':
      return `Ты проверяешь рюкзак: ${
        inventory.length > 0 ? inventory.map((item) => item.name).join(', ') : 'ничего, кроме пыли'
      }.`;
    case 'stats':
      return `HP: ${character.hp}/${character.maxHp} | КБ: ${character.ac} | Золото: ${character.gold} зол. | Уровень: ${character.level}`;
    case 'attack':
      return room.enemies.length > 0
        ? 'Ты готовишь оружие — используй панель боя, чтобы нанести удар!'
        : 'Здесь не с кем сражаться.';
    default:
      return pick(UNKNOWN_ACTION_RESPONSES);
  }
}
