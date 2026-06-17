// ============================================================================
// Character-creation logic: point-buy math, racial bonuses, and assembling the
// final Character + starting inventory. Pure functions, no React.
// ============================================================================

import type {
  Character,
  CharacterBackground,
  CharacterClass,
  CharacterRace,
  Item,
  Stats,
} from '../../types';
import {
  BACKGROUND_BY_ID,
  CLASS_BY_ID,
  NAMES,
  POINT_BUY_BUDGET,
  POINT_BUY_COST,
  RACE_BY_ID,
  STARTING_INVENTORY,
  STAT_KEYS,
  STAT_MAX,
  STAT_MIN,
} from './data';
import type { StartItemSpec, StatKey } from './data';

/** Fully-specified selections produced by the creation wizard. */
export interface CharacterDraft {
  race: CharacterRace;
  class: CharacterClass;
  name: string;
  baseStats: Stats;
  background: CharacterBackground;
}

// ---------------------------------------------------------------------------
// Ability scores & point buy
// ---------------------------------------------------------------------------

/** D&D 5e ability modifier: floor((score - 10) / 2). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Format a modifier with an explicit sign, e.g. "+3" or "-1". */
export function formatModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

/** Fresh point-buy stat block: every ability at the minimum. */
export function createBaseStats(): Stats {
  return { str: STAT_MIN, dex: STAT_MIN, con: STAT_MIN, int: STAT_MIN, wis: STAT_MIN, cha: STAT_MIN };
}

function pointCost(score: number): number {
  return POINT_BUY_COST[score] ?? 0;
}

export function pointsSpent(stats: Stats): number {
  return STAT_KEYS.reduce((sum, key) => sum + pointCost(stats[key]), 0);
}

export function pointsRemaining(stats: Stats): number {
  return POINT_BUY_BUDGET - pointsSpent(stats);
}

/** Can this ability be raised — below the cap and enough points left? */
export function canIncrease(stats: Stats, key: StatKey): boolean {
  const value = stats[key];
  if (value >= STAT_MAX) return false;
  return pointCost(value + 1) - pointCost(value) <= pointsRemaining(stats);
}

/** Can this ability be lowered — still above the floor? */
export function canDecrease(stats: Stats, key: StatKey): boolean {
  return stats[key] > STAT_MIN;
}

// ---------------------------------------------------------------------------
// Derived character
// ---------------------------------------------------------------------------

/** Add a race's flat ability bonuses on top of the base point-buy scores. */
export function applyRacialBonuses(base: Stats, race: CharacterRace): Stats {
  const { bonuses } = RACE_BY_ID[race];
  return {
    str: base.str + (bonuses.str ?? 0),
    dex: base.dex + (bonuses.dex ?? 0),
    con: base.con + (bonuses.con ?? 0),
    int: base.int + (bonuses.int ?? 0),
    wis: base.wis + (bonuses.wis ?? 0),
    cha: base.cha + (bonuses.cha ?? 0),
  };
}

function computeModifiers(stats: Stats): Stats {
  return {
    str: abilityModifier(stats.str),
    dex: abilityModifier(stats.dex),
    con: abilityModifier(stats.con),
    int: abilityModifier(stats.int),
    wis: abilityModifier(stats.wis),
    cha: abilityModifier(stats.cha),
  };
}

/** Assemble the final level-1 Character from completed wizard selections. */
export function buildCharacter(draft: CharacterDraft): Character {
  const classData = CLASS_BY_ID[draft.class];
  const background = BACKGROUND_BY_ID[draft.background];
  const stats = applyRacialBonuses(draft.baseStats, draft.race);
  const modifiers = computeModifiers(stats);
  const maxHp = Math.max(1, classData.hitDie + modifiers.con);

  return {
    name: draft.name.trim(),
    race: draft.race,
    class: draft.class,
    background: draft.background,
    level: 1,
    xp: 0,
    xpToNext: 300,
    proficiencyBonus: 2,
    hp: maxHp,
    maxHp,
    ac: 10 + modifiers.dex,
    gold: classData.startingGold + background.bonusGold,
    stats,
    modifiers,
    statusEffects: [],
    spellSlots: classData.isCaster ? [{ level: 1, current: 2, max: 2 }] : [],
    talents: [],
  };
}

// ---------------------------------------------------------------------------
// Starting inventory & intro narrative
// ---------------------------------------------------------------------------

function specToItem(spec: StartItemSpec): Item {
  return {
    id: crypto.randomUUID(),
    name: spec.name,
    type: spec.type,
    rarity: spec.rarity ?? 'common',
    weight: spec.weight ?? 0,
    value: spec.value ?? 0,
    description: spec.description,
    icon: spec.icon,
    weaponStats: spec.weaponStats,
    armorStats: spec.armorStats,
  };
}

/** Build the class's starting inventory as concrete Item objects (fresh ids). */
export function buildStartingInventory(characterClass: CharacterClass): Item[] {
  return STARTING_INVENTORY[characterClass].map(specToItem);
}

/** Pick a random themed name for the given race. */
export function randomName(race: CharacterRace): string {
  const pool = NAMES[race];
  return pool[Math.floor(Math.random() * pool.length)];
}

const INTRO_NARRATIVES: Record<CharacterClass, string> = {
  fighter:
    'Сталь позвякивает на бедре, дым факелов щиплет глаза. Пасть подземелья распахнулась перед тобой — а ты никогда не привык отступать от драки.',
  rogue:
    'Привычка уводит тебя в тень. Где-то в темноте внизу ждут замки, которые стоит вскрыть, и карманы, которые стоит опустошить. Тихо ты ступаешь внутрь.',
  wizard:
    'Арканные знаки всё ещё тлеют за веками. Руины впереди гудят забытой магией, и твоя книга заклинаний почти ноет, прося раскрыться. Знание ждёт.',
  cleric:
    'Ты шепчешь молитву, и святой символ теплеет в ладони. В глубинах гнездится нечто мерзкое, и твой бог послал тебе это испытание. Ты спускаешься.',
  ranger:
    'Ты читаешь следы, что другие бы не заметили — отметины когтей, расколотый камень, запах чего-то большого. Дикость ушла под землю, и ты идёшь по её следу.',
  bard:
    'Любая великая песня нуждается в великом деянии. Ты подтягиваешь струны, ухмыляешься, хоть никто и не видит, и шагаешь во тьму в поисках истории, достойной рассказа.',
};

/** Short class-specific opening line added to the narrative log. */
export function getIntroNarrative(characterClass: CharacterClass): string {
  return INTRO_NARRATIVES[characterClass];
}
