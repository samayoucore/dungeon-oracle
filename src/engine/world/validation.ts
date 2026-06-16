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

/** Matches "1d6", "10d100", "2d8+3" — count(1-2 digits) d sides(1-3) +bonus(1-2). */
const DICE_REGEX = /^(\d{1,2})d(\d{1,3})(?:\+(\d{1,2}))?$/;

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
// Reward clamps (Phase 8) — keep AI-granted gold/xp level-appropriate.
// ---------------------------------------------------------------------------

export function clampGoldChange(value: number, depth: number): number {
  const max = clamp(depth * 15 + 10, 10, 500);
  return clamp(value, -max, max);
}

export function clampXpGain(value: number, level: number): number {
  const max = clamp(level * 30 + 20, 20, 400);
  return clamp(value, 0, max);
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

/** Parse a dice string into the engine's {count, dice, bonus} shape, or null. */
function parseDice(input: string | undefined): ParsedDice | null {
  if (!input) return null;
  const match = DICE_REGEX.exec(input.trim());
  if (!match) return null;
  const count = clamp(parseInt(match[1], 10), 1, 12);
  const sides = clamp(parseInt(match[2], 10), 4, 100);
  const bonus = match[3] ? clamp(parseInt(match[3], 10), 0, 20) : 0;
  const die = VALID_DICE.includes(`d${sides}` as DiceType) ? (`d${sides}` as DiceType) : nearestDie(sides);
  return { damageCount: count, damageDice: die, damageBonus: bonus };
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

function clampAttacks(raw: RawAttack[] | undefined, depth: number): EnemyAttack[] {
  const maxToHit = Math.floor(depth) + 5;
  const attacks: EnemyAttack[] = (raw ?? []).map((a) => {
    const dice = parseDice(a.damageDice) ?? parseDice(a.damage) ?? { damageCount: 1, damageDice: 'd6' as DiceType, damageBonus: 0 };
    return {
      name: a.name ?? 'Удар',
      toHitBonus: clamp(a.attackBonus ?? a.toHitBonus ?? 2, 0, maxToHit),
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
  const cr = clamp(raw.cr ?? d * 0.5, d * 0.4, d * 1.5 + 0.5);
  const baseHp = Math.round(cr * 12 + 5);
  const hp = Math.round(clamp(raw.hp ?? baseHp, baseHp * 0.6, baseHp * 1.6) * ENEMY_HP_MULT[getDifficulty()]);
  const ac = Math.round(clamp(raw.ac ?? 12, 8, 20));

  const nameLower = (raw.name ?? '').toLowerCase();
  const mustFight = raw.mustFight === true || cr >= 4 || BOSS_KEYWORDS.some((kw) => nameLower.includes(kw));
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

function clampWeapon(raw: RawWeaponStats | undefined): WeaponStats | undefined {
  if (!raw) return undefined;
  const dice = parseDice(raw.damageDice) ?? { damageCount: 1, damageDice: 'd6' as DiceType, damageBonus: 0 };
  return {
    damageDice: dice.damageDice,
    damageCount: dice.damageCount,
    damageBonus: dice.damageBonus,
    damageType: asDamageType(raw.damageType, 'slashing'),
    finesse: raw.finesse === true || undefined,
    twoHanded: raw.twoHanded === true || undefined,
    ranged: raw.ranged === true || undefined,
  };
}

function clampArmor(raw: RawArmorStats | undefined, type: ItemType): ArmorStats | undefined {
  if (!raw) return undefined;
  const slot: EquipmentSlot = raw.slot ?? (type === 'shield' ? 'offHand' : 'body');
  const fallback = type === 'shield' ? 2 : 11;
  const baseAc = Math.round(clamp(raw.baseAc ?? raw.acBonus ?? fallback, 1, 20));
  const armor: ArmorStats = { baseAc, slot };
  if (typeof raw.maxDexBonus === 'number') armor.maxDexBonus = Math.round(clamp(raw.maxDexBonus, 0, 10));
  return armor;
}

/**
 * Build a safe Item from arbitrary AI output. Pass `isLoot` for items the
 * player finds/loots (applies the difficulty loot-value multiplier); leave it
 * false for shop stock, starting gear and equipment.
 */
export function clampGeneratedItem(raw: RawItem, isLoot = false): Item {
  const type: ItemType = raw.type && ITEM_TYPES.has(raw.type) ? raw.type : 'misc';
  const rarity: ItemRarity = raw.rarity && RARITIES.has(raw.rarity) ? raw.rarity : 'common';
  const [lo, hi] = RARITY_VALUE_RANGE[rarity];
  const baseValue = Math.round(clamp(raw.value ?? lo, lo, hi));
  const value = isLoot ? Math.round(baseValue * LOOT_VALUE_MULT[getDifficulty()]) : baseValue;

  return {
    id: crypto.randomUUID(),
    name: raw.name?.trim() || 'Странный предмет',
    type,
    rarity,
    value,
    weight: clamp(raw.weight ?? 1, 0.1, 50),
    description: raw.description ?? '',
    icon: raw.icon || '❓',
    weaponStats: clampWeapon(raw.weaponStats),
    armorStats: clampArmor(raw.armorStats, type),
    potionEffect: raw.potionEffect,
  };
}
