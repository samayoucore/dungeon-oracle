// ============================================================================
// Talent tree (Phase 12). At levels 2 and 5 the hero picks between an
// offensive and a defensive path instead of a fixed class feature. Mechanics
// are shared across classes (only the names differ) for easy balancing.
// Pure data + lookup helpers — no React, no store.
// ============================================================================

import type { CharacterClass, TalentEffectKind, TalentOption } from '../../types';

export type { TalentEffectKind, TalentOption } from '../../types';

const CLASSES: CharacterClass[] = ['fighter', 'rogue', 'wizard', 'cleric', 'ranger', 'bard'];

/** Level-2 names: [offensive (damage_bonus_low_hp), defensive (damage_reduction)]. */
const L2_NAMES: Record<CharacterClass, [string, string]> = {
  fighter: ['Берсерк', 'Защитник'],
  rogue: ['Безрассудство', 'Уклонение'],
  wizard: ['Боевая ярость', 'Защитный покров'],
  cleric: ['Праведный гнев', 'Стойкость духа'],
  ranger: ['Хищник', 'Страж'],
  bard: ['Боевой гимн', 'Отвлекающий манёвр'],
};

/** Level-5 names: [crit (crit_range_expand), lifesteal (heal_on_kill)]. */
const L5_NAMES: Record<CharacterClass, [string, string]> = {
  fighter: ['Палач', 'Кровопийца'],
  rogue: ['Смертельная точность', 'Жажда крови'],
  wizard: ['Точное колдовство', 'Поглощение жизни'],
  cleric: ['Кара небес', 'Похищение жизни'],
  ranger: ['Меткий глаз', 'Жнец'],
  bard: ['Крещендо', 'Вампирическая мелодия'],
};

const L8_NAMES: Record<CharacterClass, [string, string]> = {
  fighter: ['Несгибаемый клинок', 'Живая крепость'],
  rogue: ['Тень между рёбрами', 'Исчезающий шаг'],
  wizard: ['Разлом заклинаний', 'Мантия силы'],
  cleric: ['Свет карающий', 'Обет стойкости'],
  ranger: ['Охотничий приговор', 'Следопыт-страж'],
  bard: ['Разящий куплет', 'Нота спасения'],
};

const L11_NAMES: Record<CharacterClass, [string, string]> = {
  fighter: ['Финальный натиск', 'Последний бастион'],
  rogue: ['Идеальное лезвие', 'Неуловимый выживший'],
  wizard: ['Фокус архимага', 'Зеркало жизни'],
  cleric: ['Суд небес', 'Священная выдержка'],
  ranger: ['Сердце охоты', 'Каменная тропа'],
  bard: ['Гром аплодисментов', 'Бессмертный рефрен'],
};

function option(
  cls: CharacterClass,
  id: string,
  level: number,
  position: { x: number; y: number },
  name: string,
  description: string,
  effect: TalentOption['effect'],
  requires?: string[],
): TalentOption {
  return { id: `${cls}_${id}`, level, position, name, description, effect, requires };
}

function buildTree(): Record<CharacterClass, Record<number, TalentOption[]>> {
  const tree = {} as Record<CharacterClass, Record<number, TalentOption[]>>;
  for (const cls of CLASSES) {
    const l2Off = `${cls}_l2_off`;
    const l2Def = `${cls}_l2_def`;
    const l5Crit = `${cls}_l5_crit`;
    const l5Guard = `${cls}_l5_guard`;
    const l8Burst = `${cls}_l8_burst`;
    const l8Ward = `${cls}_l8_ward`;
    tree[cls] = {
      2: [
        option(cls, 'l2_off', 2, { x: 90, y: 120 }, L2_NAMES[cls][0], '+2 к урону, когда твоё HP ниже половины.', { kind: 'damage_bonus_low_hp', amount: 2 }),
        option(cls, 'l2_def', 2, { x: 90, y: 300 }, L2_NAMES[cls][1], '−1 к получаемому урону.', { kind: 'damage_reduction', amount: 1 }),
      ],
      5: [
        option(cls, 'l5_crit', 5, { x: 310, y: 70 }, L5_NAMES[cls][0], 'Критический удар срабатывает на 19-20.', { kind: 'crit_range_expand' }, [l2Off]),
        option(cls, 'l5_heal', 5, { x: 310, y: 210 }, L5_NAMES[cls][1], 'Восстанавливаешь 1к4 HP при убийстве врага.', { kind: 'heal_on_kill' }),
        option(cls, 'l5_guard', 5, { x: 310, y: 350 }, 'Плотная защита', 'Снижаешь входящий урон ещё на 1.', { kind: 'damage_reduction', amount: 2 }, [l2Def]),
      ],
      8: [
        option(cls, 'l8_burst', 8, { x: 560, y: 130 }, L8_NAMES[cls][0], '+4 к урону, когда твоё HP ниже половины.', { kind: 'damage_bonus_low_hp', amount: 4 }, [l5Crit]),
        option(cls, 'l8_ward', 8, { x: 560, y: 300 }, L8_NAMES[cls][1], 'Входящий урон снижается на 3.', { kind: 'damage_reduction', amount: 3 }, [l5Guard]),
      ],
      11: [
        option(cls, 'l11_finale', 11, { x: 800, y: 120 }, L11_NAMES[cls][0], '+6 к урону в опасном состоянии.', { kind: 'damage_bonus_low_hp', amount: 6 }, [l8Burst]),
        option(cls, 'l11_survive', 11, { x: 800, y: 300 }, L11_NAMES[cls][1], 'Восстанавливаешь 1к4 HP за каждого добитого врага и держишь оборону лучше.', { kind: 'heal_on_kill' }, [l8Ward]),
      ],
    };
  }
  return tree;
}

export const TALENT_TREE: Record<CharacterClass, Record<number, TalentOption[]>> = buildTree();

/** The two talent options offered to this class at this level, or undefined. */
export function getTalentChoices(characterClass: CharacterClass, level: number): TalentOption[] | undefined {
  return TALENT_TREE[characterClass]?.[level];
}

/** All nodes for a class, ordered by level then vertical position. */
export function getTalentTree(characterClass: CharacterClass): TalentOption[] {
  return Object.values(TALENT_TREE[characterClass] ?? {})
    .flat()
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || (a.position?.y ?? 0) - (b.position?.y ?? 0));
}

/**
 * Find the active talent option of a given effect kind among the hero's chosen
 * talent ids. Returns undefined when none is active (safe on missing talents).
 */
export function getActiveTalentEffect(talents: string[] | undefined, kind: TalentEffectKind): TalentOption | undefined {
  if (!talents || talents.length === 0) return undefined;
  let best: TalentOption | undefined;
  for (const cls of CLASSES) {
    for (const options of Object.values(TALENT_TREE[cls])) {
      for (const option of options) {
        if (option.effect.kind !== kind || !talents.includes(option.id)) continue;
        if (!best || (option.effect.amount ?? 0) > (best.effect.amount ?? 0)) best = option;
      }
    }
  }
  return best;
}
