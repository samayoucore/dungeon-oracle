// ============================================================================
// Minimal Phase-3 bestiary. Each factory returns a fresh Enemy (new id).
// Stats follow the D&D 5e-inspired statblocks from the design doc.
// ============================================================================

import type { Biome, DamageType, DiceType, Enemy, EnemyBehavior, Stats } from '../../types';

function abilityBlock(overrides: Partial<Stats>): Stats {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...overrides };
}

interface Template {
  name: string;
  cr: number;
  hp: number;
  ac: number;
  stats: Stats;
  attack: { name: string; toHit: number; count: number; dice: DiceType; bonus: number; type: DamageType };
  behavior: EnemyBehavior;
  biomes: Biome[];
  xp: number;
}

function spawn(template: Template): Enemy {
  const { attack } = template;
  return {
    id: crypto.randomUUID(),
    name: template.name,
    cr: template.cr,
    hp: template.hp,
    maxHp: template.hp,
    ac: template.ac,
    stats: template.stats,
    attacks: [
      {
        name: attack.name,
        toHitBonus: attack.toHit,
        damageDice: attack.dice,
        damageCount: attack.count,
        damageBonus: attack.bonus,
        damageType: attack.type,
      },
    ],
    behavior: template.behavior,
    lootTable: [],
    biomes: template.biomes,
    xpReward: template.xp,
  };
}

export function createGoblin(): Enemy {
  return spawn({
    name: 'Гоблин', cr: 0.25, hp: 7, ac: 15,
    stats: abilityBlock({ dex: 14, con: 10 }),
    attack: { name: 'Скимитар', toHit: 4, count: 1, dice: 'd6', bonus: 2, type: 'slashing' },
    behavior: 'aggressive', biomes: ['cave', 'ruins', 'forest'], xp: 50,
  });
}

export function createSkeleton(): Enemy {
  return spawn({
    name: 'Скелет', cr: 0.25, hp: 13, ac: 13,
    stats: abilityBlock({ dex: 14 }),
    attack: { name: 'Костяной коготь', toHit: 4, count: 1, dice: 'd6', bonus: 2, type: 'piercing' },
    behavior: 'aggressive', biomes: ['crypt', 'ruins'], xp: 50,
  });
}

export function createZombie(): Enemy {
  return spawn({
    name: 'Зомби', cr: 0.25, hp: 22, ac: 8,
    stats: abilityBlock({ str: 13, con: 16, dex: 6 }),
    attack: { name: 'Удар', toHit: 3, count: 1, dice: 'd6', bonus: 1, type: 'bludgeoning' },
    behavior: 'aggressive', biomes: ['crypt', 'ruins'], xp: 50,
  });
}

export function createOrc(): Enemy {
  return spawn({
    name: 'Орк', cr: 0.5, hp: 15, ac: 13,
    stats: abilityBlock({ str: 16, con: 16 }),
    attack: { name: 'Секира', toHit: 5, count: 1, dice: 'd12', bonus: 3, type: 'slashing' },
    behavior: 'berserker', biomes: ['cave', 'ruins'], xp: 100,
  });
}

export function createDarkMage(): Enemy {
  return spawn({
    name: 'Тёмный маг', cr: 1, hp: 22, ac: 12,
    stats: abilityBlock({ int: 16, dex: 14 }),
    attack: { name: 'Огненная стрела', toHit: 5, count: 3, dice: 'd6', bonus: 0, type: 'fire' },
    behavior: 'tactical', biomes: ['crypt', 'castle', 'ruins'], xp: 200,
  });
}

export function createTroll(): Enemy {
  return spawn({
    name: 'Тролль', cr: 5, hp: 84, ac: 15,
    stats: abilityBlock({ str: 18, con: 20, dex: 13 }),
    attack: { name: 'Коготь', toHit: 7, count: 2, dice: 'd6', bonus: 4, type: 'slashing' },
    behavior: 'aggressive', biomes: ['cave', 'forest'], xp: 1800,
  });
}
