// ============================================================================
// AI content validation (Phase 7). The DM model may return enemies/items with
// arbitrary numbers — these helpers clamp everything to safe, level-appropriate
// ranges so generated content can never break the combat math or economy.
// Pure functions, no React, no store.
// ============================================================================

import type {
  ArmorStats,
  DamageType,
  DiceType,
  EnemyAttack,
  EnemyBehavior,
  Enemy,
  EquipmentSlot,
  Item,
  ItemRarity,
  ItemType,
  LocationType,
  PotionEffect,
  Stats,
  WeaponStats,
} from '../../types';

// ---------------------------------------------------------------------------
// Loose input shapes — what the model actually sends (everything optional).
// ---------------------------------------------------------------------------

export interface RawAttack {
  name?: string;
  attackBonus?: number;
  toHitBonus?: number;
  /** Dice string, e.g. "1d6" or "2d8+3". */
  damageDice?: string;
  damage?: string;
  damageType?: string;
}

export interface RawEnemy {
  name?: string;
  cr?: number;
  hp?: number;
  ac?: number;
  stats?: Stats;
  attacks?: RawAttack[];
  behavior?: string;
  mustFight?: boolean;
  description?: string;
  icon?: string;
}

export interface RawWeaponStats {
  damageDice?: string;
  damageBonus?: number;
  damageType?: string;
  finesse?: boolean;
  twoHanded?: boolean;
  ranged?: boolean;
}

export interface RawArmorStats {
  baseAc?: number;
  acBonus?: number;
  maxDexBonus?: number;
  slot?: EquipmentSlot;
}

export interface RawItem {
  name?: string;
  type?: ItemType;
  rarity?: ItemRarity;
  value?: number;
  weight?: number;
  description?: string;
  icon?: string;
  weaponStats?: RawWeaponStats;
  armorStats?: RawArmorStats;
  potionEffect?: PotionEffect;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Matches "1d6", "10d100", "2d8+3" or "1к8 + 9". */
const DICE_REGEX = /^(\d{1,3})[dк](\d{1,4})(?:([+-])(\d{1,7}))?$/i;
const DICE_IN_TEXT_REGEX = /(\d{1,3})\s*[dк]\s*(\d{1,4})(?:\s*([+-])\s*(\d{1,7}))?/i;

const VALID_DICE: DiceType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
const DAMAGE_TYPES = new Set<DamageType>([
  'slashing', 'piercing', 'bludgeoning', 'fire', 'cold', 'poison', 'necrotic', 'radiant', 'lightning',
]);
const BEHAVIORS = new Set<EnemyBehavior>(['aggressive', 'tactical', 'support', 'coward', 'berserker']);
const ITEM_TYPES = new Set<ItemType>(['weapon', 'armor', 'shield', 'potion', 'artifact', 'quest', 'misc']);
const RARITIES = new Set<ItemRarity>(['common', 'uncommon', 'rare', 'very-rare', 'legendary']);

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

const STORY_NUMBER_LIMIT = 999_999_999;

/** Keep player/AI-declared numbers exact unless they would break JS/game math. */
export function sanitizeStoryNumber(value: number, fallback = 0, limit = STORY_NUMBER_LIMIT): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(clamp(value, -limit, limit));
}

export function sanitizePositiveStoryNumber(value: number, fallback = 0, limit = STORY_NUMBER_LIMIT): number {
  return Math.max(0, sanitizeStoryNumber(value, fallback, limit));
}

// ---------------------------------------------------------------------------
// Difficulty (Phase 8) — read from localStorage, chosen in Settings.
// ---------------------------------------------------------------------------

export type Difficulty = 'easy' | 'normal' | 'hardcore';

export function getDifficulty(): Difficulty {
  try {
    const value = typeof localStorage !== 'undefined' ? localStorage.getItem('dm_difficulty') : null;
    return value === 'easy' || value === 'hardcore' ? value : 'normal';
  } catch {
    return 'normal';
  }
}

const ENEMY_HP_MULT: Record<Difficulty, number> = { easy: 0.8, normal: 1.0, hardcore: 1.3 };
const LOOT_VALUE_MULT: Record<Difficulty, number> = { easy: 1.1, normal: 1.0, hardcore: 1.0 };

// ---------------------------------------------------------------------------
// Reward guards — protect math without overriding sandbox-style player wishes.
// ---------------------------------------------------------------------------

export function clampGoldChange(value: number, depth: number): number {
  void depth;
  return sanitizeStoryNumber(value);
}

export function clampXpGain(value: number, level: number): number {
  void level;
  return sanitizePositiveStoryNumber(value);
}

/**
 * Keep HP deltas numerically sane. updateHp still clamps current HP to [0, maxHp].
 */
export function clampNarrativeHp(value: number, maxHp: number): number {
  void maxHp;
  return sanitizeStoryNumber(value, 0, 1_000_000);
}

export function dangerLevelForLocation(
  type: LocationType,
  isSafeZone: boolean | undefined,
  previousDanger: number,
  depthDelta?: number,
  explicitDanger?: number,
): number {
  if (typeof explicitDanger === 'number' && Number.isFinite(explicitDanger)) {
    return Math.round(clamp(explicitDanger, 1, 20));
  }
  if (isSafeZone || type === 'town' || type === 'building_interior') return 1;
  const delta = typeof depthDelta === 'number' && Number.isFinite(depthDelta) ? depthDelta : 0;
  const base = clamp(previousDanger, 1, 20);
  return Math.round(clamp(base + delta, 1, 20));
}

/** Snap an arbitrary number of sides to the nearest legal die. */
function nearestDie(sides: number): DiceType {
  const allowed = [4, 6, 8, 10, 12, 20, 100];
  const best = allowed.reduce((a, b) => (Math.abs(b - sides) < Math.abs(a - sides) ? b : a), 6);
  return (`d${best}`) as DiceType;
}

interface ParsedDice {
  damageCount: number;
  damageDice: DiceType;
  damageBonus: number;
}

function normalizeDiceText(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '');
}

/** Parse a dice string into the engine's {count, dice, bonus} shape, or null. */
function parseDice(input: string | undefined): ParsedDice | null {
  if (!input) return null;
  const match = DICE_REGEX.exec(normalizeDiceText(input));
  if (!match) return null;
  const count = clamp(parseInt(match[1], 10), 1, 100);
  const sides = clamp(parseInt(match[2], 10), 4, 1000);
  const rawBonus = match[4] ? parseInt(match[4], 10) : 0;
  const bonus = clamp(match[3] === '-' ? -rawBonus : rawBonus, -1_000_000, 1_000_000);
  const die = VALID_DICE.includes(`d${sides}` as DiceType) ? (`d${sides}` as DiceType) : nearestDie(sides);
  return { damageCount: count, damageDice: die, damageBonus: bonus };
}

function parseDiceFromText(text: string): ParsedDice | null {
  const match = DICE_IN_TEXT_REGEX.exec(text);
  if (!match) return null;
  return parseDice(`${match[1]}d${match[2]}${match[3] ?? ''}${match[4] ?? ''}`);
}

function storyNumbers(text: string): number[] {
  const matches = text.match(/-?\d[\d _]*/g);
  if (!matches) return [];
  return matches
    .map((raw) => Number(raw.replace(/[ _]/g, '')))
    .filter(Number.isFinite);
}

function largestPositiveNumber(text: string, limit = 1_000_000): number | null {
  const values = storyNumbers(text).filter((n) => n > 0).map((n) => sanitizePositiveStoryNumber(n, 0, limit));
  if (values.length === 0) return null;
  return values.reduce((best, value) => (value > best ? value : best), values[0]);
}

function flatDamageToDice(value: number): ParsedDice {
  const exact = sanitizePositiveStoryNumber(value, 1, 1_000_000);
  // The combat roller adds dice + bonus. This keeps a requested "10000 damage"
  // as a real huge hit instead of shrinking it to a level-scaled weapon.
  return { damageCount: 1, damageDice: 'd4', damageBonus: Math.max(0, exact - 1) };
}

function damageCeiling(dice: ParsedDice): number {
  return dice.damageCount * parseInt(dice.damageDice.slice(1), 10) + dice.damageBonus;
}

function inferDamageDiceFromText(text: string, rarity: ItemRarity): ParsedDice | null {
  const explicitDice = parseDiceFromText(text);
  if (explicitDice) return explicitDice;

  const lower = text.toLowerCase();
  const damageWordNearNumber =
    /(?:урон|урона|уроном|damage|dmg)[^\d-]{0,28}(-?\d[\d _]*)/i.exec(lower)?.[1] ??
    /(-?\d[\d _]*)[^\d]{0,28}(?:урон|урона|уроном|damage|dmg)/i.exec(lower)?.[1];
  if (damageWordNearNumber) {
    const flat = Number(damageWordNearNumber.replace(/[ _]/g, ''));
    if (Number.isFinite(flat) && flat > 0) return flatDamageToDice(flat);
  }

  const largest = largestPositiveNumber(text);
  if (largest && /меч|клин|топор|молот|лук|арбалет|посох|копь|кинжал|weapon|sword|damage/i.test(lower)) {
    return flatDamageToDice(largest);
  }

  if (rarity === 'legendary') return { damageCount: 3, damageDice: 'd100', damageBonus: 50 };
  if (rarity === 'very-rare') return { damageCount: 2, damageDice: 'd100', damageBonus: 20 };
  if (rarity === 'rare') return { damageCount: 2, damageDice: 'd20', damageBonus: 8 };
  return null;
}

function inferArmorAcFromText(text: string, type: ItemType): number | null {
  const lower = text.toLowerCase();
  const acWordNearNumber =
    /(?:кб|класс брони|броня|защита|ac|armor)[^\d-]{0,28}(-?\d[\d _]*)/i.exec(lower)?.[1] ??
    /(-?\d[\d _]*)[^\d]{0,28}(?:кб|класс брони|брони|защиты|ac|armor)/i.exec(lower)?.[1];
  if (acWordNearNumber) {
    const value = Number(acWordNearNumber.replace(/[ _]/g, ''));
    if (Number.isFinite(value) && value > 0) return sanitizePositiveStoryNumber(value, type === 'shield' ? 2 : 11, 1_000_000);
  }
  const largest = largestPositiveNumber(text);
  if (largest && /брон|доспех|щит|защит|кб|armor|shield|ac/i.test(lower)) return largest;
  return null;
}

function asDamageType(value: string | undefined, fallback: DamageType): DamageType {
  return value && DAMAGE_TYPES.has(value as DamageType) ? (value as DamageType) : fallback;
}

// ---------------------------------------------------------------------------
// Ability scores by CR
// ---------------------------------------------------------------------------

const STAT_KEYS: (keyof Stats)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Stats grow with CR: base 10, +1 to two random abilities per full 2 CR, cap 20. */
export function defaultStatsForCR(cr: number): Stats {
  const stats: Stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const steps = Math.floor(Math.max(0, cr) / 2);
  for (let i = 0; i < steps; i += 1) {
    for (let pick = 0; pick < 2; pick += 1) {
      const key = STAT_KEYS[Math.floor(Math.random() * STAT_KEYS.length)];
      stats[key] = Math.min(20, stats[key] + 1);
    }
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Enemy
// ---------------------------------------------------------------------------

const BOSS_KEYWORDS = ['босс', 'лорд', 'король', 'королева', 'древн', 'повелител', 'страж', 'хранител', 'владык'];

/** A boss-ish name only forces mustFight once the enemy is actually strong —
 *  a flavourful "древний скелет" at low CR stays a mundane, avoidable foe.
 *  Tune this to recalibrate keyword-triggered mustFight after playtesting. */
const KEYWORD_MIN_CR = 1.5;

function clampAttacks(raw: RawAttack[] | undefined, depth: number): EnemyAttack[] {
  void depth;
  const attacks: EnemyAttack[] = (raw ?? []).map((a) => {
    const dice = parseDice(a.damageDice) ?? parseDice(a.damage) ?? { damageCount: 1, damageDice: 'd6' as DiceType, damageBonus: 0 };
    return {
      name: a.name ?? 'Удар',
      toHitBonus: clamp(a.attackBonus ?? a.toHitBonus ?? 2, -20, 999),
      damageCount: dice.damageCount,
      damageDice: dice.damageDice,
      damageBonus: dice.damageBonus,
      damageType: asDamageType(a.damageType, 'bludgeoning'),
    };
  });
  if (attacks.length === 0) {
    attacks.push({ name: 'Удар', toHitBonus: 2, damageCount: 1, damageDice: 'd6', damageBonus: 0, damageType: 'bludgeoning' });
  }
  return attacks;
}

/** Build a safe Enemy from arbitrary AI output, scaled to the current depth. */
export function clampGeneratedEnemy(raw: RawEnemy, depth: number): Enemy {
  const d = clamp(depth, 1, 20);
  const cr = clamp(raw.cr ?? d * 0.5, 0, 100);
  const baseHp = Math.round(cr * 12 + 5);
  const hp = Math.max(1, Math.round(clamp(raw.hp ?? baseHp, 1, 1_000_000) * ENEMY_HP_MULT[getDifficulty()]));
  const ac = Math.round(clamp(raw.ac ?? 12, 1, 200));

  const nameLower = (raw.name ?? '').toLowerCase();
  const mustFight =
    raw.mustFight === true ||
    cr >= 4 ||
    (cr >= KEYWORD_MIN_CR && BOSS_KEYWORDS.some((kw) => nameLower.includes(kw)));
  const behavior: EnemyBehavior = raw.behavior && BEHAVIORS.has(raw.behavior as EnemyBehavior)
    ? (raw.behavior as EnemyBehavior)
    : 'aggressive';

  return {
    id: crypto.randomUUID(),
    name: raw.name?.trim() || 'Неизвестный враг',
    cr,
    hp,
    maxHp: hp,
    ac,
    stats: raw.stats ?? defaultStatsForCR(cr),
    attacks: clampAttacks(raw.attacks, d),
    behavior,
    lootTable: [],
    biomes: [],
    xpReward: Math.round(cr * 50 + 10),
    statusEffects: [],
    mustFight,
  };
}

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------

const RARITY_VALUE_RANGE: Record<ItemRarity, [number, number]> = {
  common: [1, 50],
  uncommon: [50, 200],
  rare: [200, 1000],
  'very-rare': [1000, 5000],
  legendary: [5000, 20000],
};

function inferItemType(raw: RawItem): ItemType {
  const text = `${raw.name ?? ''} ${raw.description ?? ''}`.toLowerCase();
  if (/меч|клин|топор|молот|лук|арбалет|посох|копь|кинжал|weapon|sword|bow|staff/.test(text)) return 'weapon';
  if (/щит|shield/.test(text)) return 'shield';
  if (/брон|доспех|кольчуг|armor|mail|plate/.test(text)) return 'armor';
  if (/зель|эликсир|potion/.test(text)) return 'potion';
  if (/артефакт|реликв|artifact|relic/.test(text)) return 'artifact';
  if (raw.type && ITEM_TYPES.has(raw.type)) return raw.type;
  return 'misc';
}

function clampWeapon(raw: RawWeaponStats | undefined, type: ItemType, text: string, rarity: ItemRarity): WeaponStats | undefined {
  if (!raw && type !== 'weapon') return undefined;
  const rawDice = parseDice(raw?.damageDice);
  const inferredDice = inferDamageDiceFromText(text, rarity);
  const dice =
    rawDice && inferredDice
      ? damageCeiling(inferredDice) > damageCeiling(rawDice)
        ? inferredDice
        : rawDice
      : rawDice ?? inferredDice ?? { damageCount: 1, damageDice: 'd6' as DiceType, damageBonus: 0 };
  const damageBonus = dice.damageBonus + sanitizeStoryNumber(raw?.damageBonus ?? 0, 0, 1_000_000);
  return {
    damageDice: dice.damageDice,
    damageCount: dice.damageCount,
    damageBonus,
    damageType: asDamageType(raw?.damageType, 'slashing'),
    finesse: raw?.finesse === true || undefined,
    twoHanded: raw?.twoHanded === true || undefined,
    ranged: raw?.ranged === true || undefined,
  };
}

function clampArmor(raw: RawArmorStats | undefined, type: ItemType, text: string): ArmorStats | undefined {
  if (!raw && type !== 'armor' && type !== 'shield') return undefined;
  const slot: EquipmentSlot = raw?.slot ?? (type === 'shield' ? 'offHand' : 'body');
  const fallback = type === 'shield' ? 2 : 11;
  const inferredAc = inferArmorAcFromText(text, type);
  const explicitAc = raw?.baseAc ?? raw?.acBonus;
  const requestedAc = explicitAc && inferredAc ? Math.max(explicitAc, inferredAc) : explicitAc ?? inferredAc ?? fallback;
  const baseAc = Math.round(clamp(requestedAc, 1, 1_000_000));
  const armor: ArmorStats = { baseAc, slot };
  if (typeof raw?.maxDexBonus === 'number') armor.maxDexBonus = Math.round(clamp(raw.maxDexBonus, 0, 999));
  return armor;
}

/**
 * Build a safe Item from arbitrary AI output. Pass `isLoot` for items the
 * player finds/loots (applies the difficulty loot-value multiplier); leave it
 * false for shop stock, starting gear and equipment.
 */
export function clampGeneratedItem(raw: RawItem, isLoot = false): Item {
  const type: ItemType = inferItemType(raw);
  const rarity: ItemRarity = raw.rarity && RARITIES.has(raw.rarity) ? raw.rarity : 'common';
  const [lo, hi] = RARITY_VALUE_RANGE[rarity];
  void hi;
  const baseValue = typeof raw.value === 'number' ? sanitizePositiveStoryNumber(raw.value) : lo;
  const value = isLoot ? Math.round(baseValue * LOOT_VALUE_MULT[getDifficulty()]) : baseValue;
  const text = `${raw.name ?? ''} ${raw.description ?? ''}`;

  return {
    id: crypto.randomUUID(),
    name: raw.name?.trim() || 'Странный предмет',
    type,
    rarity,
    value,
    weight: clamp(raw.weight ?? 1, 0, 5000),
    description: raw.description ?? '',
    icon: raw.icon || '❓',
    weaponStats: clampWeapon(raw.weaponStats, type, text, rarity),
    armorStats: clampArmor(raw.armorStats, type, text),
    potionEffect: raw.potionEffect,
  };
}
