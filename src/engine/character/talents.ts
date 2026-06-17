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

function buildTree(): Record<CharacterClass, Record<number, TalentOption[]>> {
  const tree = {} as Record<CharacterClass, Record<number, TalentOption[]>>;
  for (const cls of CLASSES) {
    tree[cls] = {
      2: [
        { id: `${cls}_l2_off`, name: L2_NAMES[cls][0], description: '+2 к урону, когда твоё HP ниже половины.', effect: { kind: 'damage_bonus_low_hp', amount: 2 } },
        { id: `${cls}_l2_def`, name: L2_NAMES[cls][1], description: '−1 к получаемому урону.', effect: { kind: 'damage_reduction', amount: 1 } },
      ],
      5: [
        { id: `${cls}_l5_crit`, name: L5_NAMES[cls][0], description: 'Критический удар срабатывает на 19-20.', effect: { kind: 'crit_range_expand' } },
        { id: `${cls}_l5_heal`, name: L5_NAMES[cls][1], description: 'Восстанавливаешь 1к4 HP при убийстве врага.', effect: { kind: 'heal_on_kill' } },
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

/**
 * Find the active talent option of a given effect kind among the hero's chosen
 * talent ids. Returns undefined when none is active (safe on missing talents).
 */
export function getActiveTalentEffect(talents: string[] | undefined, kind: TalentEffectKind): TalentOption | undefined {
  if (!talents || talents.length === 0) return undefined;
  for (const cls of CLASSES) {
    for (const options of Object.values(TALENT_TREE[cls])) {
      for (const option of options) {
        if (option.effect.kind === kind && talents.includes(option.id)) return option;
      }
    }
  }
  return undefined;
}
