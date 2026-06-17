// ============================================================================
// Combat engine. Pure functions only — NO React, NO store. Callers apply the
// returned TurnResults (damage, kills, logs) to game state themselves.
// ============================================================================

import type {
  Character,
  CombatState,
  DiceType,
  Enemy,
  Item,
  NarrativeType,
  StatusEffect,
  StatusEffectType,
  TurnEntry,
} from '../../types';
import { checkHit, checkHitMode, rollDamage, rollInitiative, rollRaw, roll } from './dice';
import type { AttackRoll, RollMode } from './dice';
import { createRng, randomSeed, randInt, chance } from '../random';
import { rollLoot } from '../dungeon/lootTables';
import { effectNameRu } from './statusLabels';
import { getActiveTalentEffect } from '../character/talents';

export interface TurnResult {
  narrative: string;
  damageDealt: number;
  /** Damage to the player; negative values heal. */
  damageTaken: number;
  killedEnemyId?: string;
  statusApplied?: StatusEffect;
  combatEnded: boolean;
  playerWon?: boolean;
  /** The d20 attack roll, when this turn involved an attack (drives the dice UI). */
  attackRoll?: AttackRoll;
  /** HP to restore to the player (e.g. heal-on-kill talent); applied by caller. */
  healToPlayer?: number;
}

const FLEE_DC = 12;
const BERSERK_THRESHOLD = 0.5;
const TACTICAL_RETREAT_THRESHOLD = 0.5;
const COWARD_HOLD_THRESHOLD = 0.7;
const COWARD_FLEE_THRESHOLD = 0.3;

// --- Combat flavour text ---

const FUMBLES = [
  'Ты замахиваешься слишком широко и едва не роняешь оружие.',
  'Нога скользит по камню — удар уходит в никуда.',
  'Ты теряешь равновесие и открываешься для ответного удара.',
  'Оружие проворачивается в руке и со свистом рассекает воздух.',
  'Ты неверно оцениваешь расстояние и бьёшь по пустоте.',
];
const MISSES = [
  '{enemy} отбивает твой удар.',
  '{enemy} уворачивается в сторону.',
  '{enemy} успевает отскочить от клинка.',
  'Клинок рассекает пустоту.',
];
const HITS = [
  '{enemy} получает {damage} урона от твоего удара.',
  '{enemy} теряет {damage} HP от точного удара.',
  '{enemy} принимает {damage} урона — чистое попадание!',
  'Ты крепко достаёшь врага: {damage} урона.',
];
const CRITS = [
  'Критический удар! Ты находишь уязвимое место — {damage} урона!',
  'Сокрушительный выпад! {enemy} содрогается — {damage} урона!',
  'Точно в цель! Ты разрываешь врага на {damage} урона!',
  'Крит! Удар входит глубоко — {damage} урона!',
];
const ENEMY_DEATHS = [
  '{enemy} замертво оседает на пол.',
  '{enemy} падает с последним содроганием.',
  '{enemy} рушится на пол, повержен.',
];
const ENEMY_HITS = [
  '{enemy} наносит тебе {damage} урона.',
  '{enemy} застаёт тебя врасплох — {damage} урона.',
  '{enemy} достаёт тебя, отнимая {damage} HP.',
];
const ENEMY_MISSES = [
  '{enemy} бросается вперёд, но ты отводишь удар.',
  '{enemy} замахивается и промахивается.',
  'Ты вовремя парируешь выпад врага.',
];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

function diceSides(dice: DiceType): number {
  return parseInt(dice.slice(1), 10);
}

function damageExpr(count: number, dice: DiceType, bonus: number): string {
  return `${count}d${diceSides(dice)}${bonus >= 0 ? `+${bonus}` : `${bonus}`}`;
}

function dexMod(enemy: Enemy): number {
  return Math.floor((enemy.stats.dex - 10) / 2);
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/** Roll initiative for all combatants and build a fresh CombatState. */
export function initCombat(enemies: Enemy[], character: Character): CombatState {
  // Deep-copy so combat damage never mutates the room's source enemies.
  const combatEnemies: Enemy[] = JSON.parse(JSON.stringify(enemies));
  const turnOrder: TurnEntry[] = [
    { id: 'player', kind: 'player', initiative: rollInitiative(character.modifiers.dex) },
    ...combatEnemies.map((enemy): TurnEntry => ({ id: enemy.id, kind: 'enemy', initiative: rollInitiative(dexMod(enemy)) })),
  ];
  turnOrder.sort((a, b) => b.initiative - a.initiative);
  return { active: true, round: 1, turnOrder, currentTurnIndex: 0, enemies: combatEnemies, log: [] };
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

/** Resolve a player melee/ranged attack. weaponAttackBonus is the FULL to-hit bonus. */
export function playerAttack(
  character: Character,
  targetEnemy: Enemy,
  weaponDamage: string,
  weaponAttackBonus: number,
): TurnResult {
  const enemy = targetEnemy.name;
  const blessed = character.statusEffects.some((e) => e.type === 'blessed');
  const bonus = weaponAttackBonus + (blessed ? rollRaw(4) : 0);
  const critThreshold = getActiveTalentEffect(character.talents, 'crit_range_expand') ? 19 : 20;
  const attack = checkHit(bonus, targetEnemy.ac, critThreshold);

  if (attack.isCritFail) {
    return { narrative: pick(FUMBLES), damageDealt: 0, damageTaken: 0, combatEnded: false, attackRoll: attack };
  }
  if (!attack.isHit) {
    return { narrative: fill(pick(MISSES), { enemy }), damageDealt: 0, damageTaken: 0, combatEnded: false, attackRoll: attack };
  }

  let damage = rollDamage(weaponDamage, attack.isCrit);
  // Offensive talent: extra damage while bloodied (HP below half).
  const lowHp = getActiveTalentEffect(character.talents, 'damage_bonus_low_hp');
  if (lowHp && character.maxHp > 0 && character.hp / character.maxHp < 0.5) {
    damage += lowHp.effect.amount ?? 0;
  }
  const template = attack.isCrit ? pick(CRITS) : pick(HITS);
  let narrative = fill(template, { enemy, damage: String(damage) });
  const result: TurnResult = { narrative, damageDealt: damage, damageTaken: 0, combatEnded: false, attackRoll: attack };

  if (targetEnemy.hp - damage <= 0) {
    result.killedEnemyId = targetEnemy.id;
    narrative += ` ${fill(pick(ENEMY_DEATHS), { enemy })}`;
    result.narrative = narrative;
    // Lifesteal talent: heal on kill (applied by the caller via updateHp).
    if (getActiveTalentEffect(character.talents, 'heal_on_kill')) {
      result.healToPlayer = roll('1d4');
    }
  }
  return result;
}

export function playerDodge(_character: Character): TurnResult {
  return {
    narrative: 'Ты встаёшь в защитную стойку. В этом раунде атаки по тебе — с помехой.',
    damageDealt: 0,
    damageTaken: 0,
    combatEnded: false,
  };
}

export function playerFlee(character: Character): TurnResult {
  const check = rollRaw(20) + character.modifiers.dex;
  if (check >= FLEE_DC) {
    return { narrative: 'Ты вырываешься и исчезаешь во тьме!', damageDealt: 0, damageTaken: 0, combatEnded: true, playerWon: false };
  }
  return { narrative: 'Ты пытаешься сбежать, но враг преграждает путь!', damageDealt: 0, damageTaken: 0, combatEnded: false };
}

export function playerUseItem(_character: Character, item: Item, _targetEnemyId?: string): TurnResult {
  const effect = item.potionEffect;
  if (item.type === 'potion' && effect?.effect === 'heal') {
    const healed = roll(damageExpr(effect.diceCount ?? 1, effect.diceType ?? 'd4', effect.bonus ?? 0));
    return { narrative: `Ты выпиваешь ${item.name} и восстанавливаешь ${healed} HP.`, damageDealt: 0, damageTaken: -healed, combatEnded: false };
  }
  return { narrative: 'Ничего не происходит.', damageDealt: 0, damageTaken: 0, combatEnded: false };
}

// ---------------------------------------------------------------------------
// Enemy actions
// ---------------------------------------------------------------------------

/** Resolve every living enemy's turn (in order); callers play them with delays. */
export function resolveEnemyTurns(enemies: Enemy[], character: Character, isDodging: boolean): TurnResult[] {
  const living = enemies.filter((enemy) => enemy.hp > 0);
  return living.map((enemy) => resolveEnemyAction(enemy, character, isDodging, living));
}

export function resolveEnemyAction(
  enemy: Enemy,
  character: Character,
  isDodging: boolean,
  allies?: Enemy[],
): TurnResult {
  const name = enemy.name;
  const hpFraction = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;

  // Cowards disengage or flee outright when hurt.
  if (enemy.behavior === 'coward') {
    if (hpFraction < COWARD_FLEE_THRESHOLD) {
      return { narrative: `${name} в ужасе обращается в бегство!`, damageDealt: 0, damageTaken: 0, killedEnemyId: enemy.id, combatEnded: false };
    }
    if (hpFraction < COWARD_HOLD_THRESHOLD) {
      return { narrative: `${name} трусливо съёживается и отступает!`, damageDealt: 0, damageTaken: 0, combatEnded: false };
    }
  }

  // Tacticians sometimes pull back when wounded.
  if (enemy.behavior === 'tactical' && hpFraction < TACTICAL_RETREAT_THRESHOLD && chance(createRng(randomSeed()), 0.5)) {
    return { narrative: `${name} отходит на безопасную позицию.`, damageDealt: 0, damageTaken: 0, combatEnded: false };
  }

  // Support casters mend a wounded ally instead of attacking (flavour for now).
  if (enemy.behavior === 'support' && allies) {
    const wounded = allies.find((a) => a.id !== enemy.id && a.hp > 0 && a.hp / a.maxHp < 0.5);
    if (wounded) {
      return {
        narrative: `${name} читает тёмное заклинание, и раны союзника затягиваются.`,
        damageDealt: 0,
        damageTaken: 0,
        combatEnded: false,
      };
    }
  }

  // Berserkers attack harder once bloodied.
  let attackBonus = 0;
  let damageBonus = 0;
  let prefix = '';
  if (enemy.behavior === 'berserker' && hpFraction < BERSERK_THRESHOLD) {
    attackBonus = 2;
    damageBonus = 2;
    prefix = `${name} испускает яростный рёв и атакует с безудержной свирепостью! `;
  }

  // Tacticians favour their biggest attack; others pick at random.
  const attack =
    enemy.behavior === 'tactical'
      ? enemy.attacks.reduce((best, a) => (a.damageCount * diceSides(a.damageDice) > best.damageCount * diceSides(best.damageDice) ? a : best), enemy.attacks[0])
      : pick(enemy.attacks);

  const mode: RollMode = isDodging ? 'disadvantage' : 'normal';
  const hit = checkHitMode(attack.toHitBonus + attackBonus, character.ac, mode);
  if (!hit.isHit) {
    return { narrative: prefix + fill(pick(ENEMY_MISSES), { enemy: name }), damageDealt: 0, damageTaken: 0, combatEnded: false, attackRoll: hit };
  }
  let damage = rollDamage(damageExpr(attack.damageCount, attack.damageDice, attack.damageBonus + damageBonus), hit.isCrit);
  // Defensive talent: flat damage reduction on incoming hits.
  const reduction = getActiveTalentEffect(character.talents, 'damage_reduction');
  if (reduction) damage = Math.max(0, damage - (reduction.effect.amount ?? 0));
  return { narrative: prefix + fill(pick(ENEMY_HITS), { enemy: name, damage: String(damage) }), damageDealt: 0, damageTaken: damage, combatEnded: false, attackRoll: hit };
}

// ---------------------------------------------------------------------------
// Status effects
// ---------------------------------------------------------------------------

/** Apply start-of-turn status effects to the player (poison/bleed/burn/stun). */
export function tickStatusEffects(character: Character): { character: Character; log: string[]; skipTurn: boolean } {
  const log: string[] = [];
  let hp = character.hp;
  let skipTurn = false;
  const remaining: StatusEffect[] = [];

  for (const effect of character.statusEffects) {
    let keep = effect.duration > 1;
    switch (effect.type) {
      case 'poisoned': {
        const n = roll('1d4');
        hp -= n;
        log.push(`Яд растекается по венам — ${n} урона.`);
        break;
      }
      case 'bleeding': {
        const n = roll('1d4');
        hp -= n;
        log.push(`Раны кровоточат — ${n} урона.`);
        break;
      }
      case 'burning': {
        const n = roll('1d4');
        hp -= n;
        log.push(`Пламя лижет тебя — ${n} урона.`);
        if (Math.random() < 0.3) keep = false;
        break;
      }
      case 'stunned': {
        skipTurn = true;
        keep = false;
        log.push('Ты оглушён и не можешь действовать.');
        break;
      }
      default:
        break;
    }
    if (keep) remaining.push({ ...effect, duration: effect.duration - 1 });
  }

  return { character: { ...character, hp: Math.max(0, hp), statusEffects: remaining }, log, skipTurn };
}

/** Add a status effect to a list if it isn't already present. */
export function applyStatusEffect(
  effects: StatusEffect[],
  type: StatusEffectType,
  duration: number,
  magnitude?: number,
): StatusEffect[] {
  if (effects.some((e) => e.type === type)) return effects;
  return [...effects, { type, duration, magnitude }];
}

// ---------------------------------------------------------------------------
// Out-of-combat ("world") status tick
// ---------------------------------------------------------------------------

export interface StatusTickResult {
  hp: number;
  statusEffects: StatusEffect[];
  messages: { text: string; type: NarrativeType }[];
  defeated: boolean;
}

/** Per-turn chance an effect wears off while exploring. stunned never lingers. */
const WORLD_WEAR_OFF_CHANCE: Record<StatusEffectType, number> = {
  poisoned: 0.25,
  burning: 0.3,
  bleeding: 0.2,
  frightened: 0.3,
  blinded: 0.25,
  blessed: 0.2,
  hasted: 0.25,
  stunned: 1.0,
};

const DOT_EFFECTS: StatusEffectType[] = ['poisoned', 'burning', 'bleeding'];

const DOT_MESSAGES: Record<string, (dmg: number) => string> = {
  poisoned: (dmg) => `Яд разъедает тебя изнутри — ${dmg} урона.`,
  burning: (dmg) => `Пламя обжигает кожу — ${dmg} урона.`,
  bleeding: (dmg) => `Открытая рана кровоточит — ${dmg} урона.`,
};

/**
 * Apply status effects for one exploration turn: damage-over-time ticks plus a
 * per-effect chance to wear off. Distinct from {@link tickStatusEffects} (which
 * runs each combat round and has turn-skip semantics) — do not merge them.
 */
export function tickWorldStatusEffects(character: Character): StatusTickResult {
  let hp = character.hp;
  const messages: StatusTickResult['messages'] = [];
  const remaining: StatusEffect[] = [];

  for (const effect of character.statusEffects) {
    if (DOT_EFFECTS.includes(effect.type)) {
      const dmg = roll('1d4');
      hp = Math.max(0, hp - dmg);
      messages.push({ text: DOT_MESSAGES[effect.type](dmg), type: 'combat' });
    }
    if (Math.random() < WORLD_WEAR_OFF_CHANCE[effect.type]) {
      messages.push({ text: `${effectNameRu(effect.type)}: эффект закончился.`, type: 'system' });
    } else {
      remaining.push(effect);
    }
  }

  return { hp, statusEffects: remaining, messages, defeated: hp <= 0 };
}

// ---------------------------------------------------------------------------
// Resolution & loot
// ---------------------------------------------------------------------------

export function checkCombatEnd(enemies: Enemy[], character: Character): { ended: boolean; playerWon: boolean } {
  const playerWon = enemies.every((enemy) => enemy.hp <= 0);
  return { ended: playerWon || character.hp <= 0, playerWon };
}

/** Roll rewards for the defeated enemies: XP, gold and a few dropped items. */
export function resolveLoot(enemies: Enemy[]): { items: Item[]; gold: number; xp: number } {
  const rng = createRng(randomSeed());
  let xp = 0;
  let gold = 0;
  const items: Item[] = [];
  for (const enemy of enemies) {
    xp += enemy.xpReward;
    gold += randInt(rng, 3, 12) + Math.round(enemy.cr * 10);
    if (chance(rng, 0.4)) items.push(...rollLoot(rng, 1));
  }
  return { items, gold, xp };
}
