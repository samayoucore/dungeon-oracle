// ============================================================================
// Dice parser & roller. Pure functions; randomness via Math.random.
// Supported expression format: "2d6+3", "1d20", "d8-1", "3d4".
// ============================================================================

export interface AttackRoll {
  /** The raw d20 result. */
  d20: number;
  /** d20 + attack bonus. */
  total: number;
  isCrit: boolean;
  isCritFail: boolean;
  /** total >= AC, or a natural 20 (crits always hit). */
  isHit: boolean;
}

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

const DICE_RE = /^(\d*)d(\d+)([+-]\d+)?$/i;

/** Roll a single die with the given number of sides. */
export function rollRaw(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/** Parse and evaluate a dice expression, returning the summed total. */
export function roll(expression: string): number {
  const match = DICE_RE.exec(expression.trim());
  if (!match) return 0;
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  let total = modifier;
  for (let i = 0; i < count; i += 1) total += rollRaw(sides);
  return total;
}

/** Roll twice, keep the higher. */
export function rollWithAdvantage(sides: number): { result: number; rolls: [number, number] } {
  const rolls: [number, number] = [rollRaw(sides), rollRaw(sides)];
  return { result: Math.max(rolls[0], rolls[1]), rolls };
}

/** Roll twice, keep the lower. */
export function rollWithDisadvantage(sides: number): { result: number; rolls: [number, number] } {
  const rolls: [number, number] = [rollRaw(sides), rollRaw(sides)];
  return { result: Math.min(rolls[0], rolls[1]), rolls };
}

/** Initiative roll: d20 + DEX modifier. */
export function rollInitiative(dexMod: number): number {
  return rollRaw(20) + dexMod;
}

/** Resolve an attack with an explicit advantage/disadvantage mode.
 *  critThreshold lets talents widen the crit range (e.g. 19-20). */
export function checkHitMode(attackBonus: number, targetAC: number, mode: RollMode, critThreshold = 20): AttackRoll {
  const d20 =
    mode === 'advantage'
      ? rollWithAdvantage(20).result
      : mode === 'disadvantage'
        ? rollWithDisadvantage(20).result
        : rollRaw(20);
  const total = d20 + attackBonus;
  return {
    d20,
    total,
    isCrit: d20 >= critThreshold,
    isCritFail: d20 === 1,
    isHit: d20 === 20 || total >= targetAC,
  };
}

/** Standard (no advantage) attack check. */
export function checkHit(attackBonus: number, targetAC: number, critThreshold = 20): AttackRoll {
  return checkHitMode(attackBonus, targetAC, 'normal', critThreshold);
}

/** Roll damage; on a crit the dice count is doubled (bonuses are not). */
export function rollDamage(expression: string, isCrit: boolean): number {
  if (!isCrit) return roll(expression);
  const match = DICE_RE.exec(expression.trim());
  if (!match) return roll(expression);
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = match[2];
  const modifier = match[3] ?? '';
  return roll(`${count * 2}d${sides}${modifier}`);
}
