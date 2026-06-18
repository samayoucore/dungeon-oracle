// ============================================================================
// Player-facing status-effect labels with emoji. Shared between the combat
// engine (out-of-combat status tick) and the store (DM-applied effects).
// ============================================================================

import type { StatusEffectType } from '../../types';

export interface StatusEffectMeta {
  label: string;
  icon: string;
  description: string;
  mechanics: string;
}

export const STATUS_EFFECT_META: Record<StatusEffectType, StatusEffectMeta> = {
  poisoned: {
    label: 'Отравление',
    icon: '☠',
    description: 'Яд постепенно ослабляет героя и может добить во время исследования.',
    mechanics: 'В бою и вне боя периодически наносит 1к4 урона, пока эффект не закончится.',
  },
  stunned: {
    label: 'Оглушение',
    icon: '✦',
    description: 'Герой теряет темп и не может нормально действовать.',
    mechanics: 'В бою пропускает ближайшее действие; вне боя быстро спадает.',
  },
  burning: {
    label: 'Горение',
    icon: '🔥',
    description: 'Пламя продолжает причинять урон после основной атаки.',
    mechanics: 'Наносит 1к4 урона за тик и имеет повышенный шанс погаснуть само.',
  },
  bleeding: {
    label: 'Кровотечение',
    icon: '✚',
    description: 'Открытая рана забирает здоровье при каждом напряжённом ходе.',
    mechanics: 'Наносит 1к4 урона за тик, пока рана не затянется или не будет снята отдыхом/лечением.',
  },
  frightened: {
    label: 'Испуг',
    icon: '!',
    description: 'Страх мешает уверенно принимать рискованные решения.',
    mechanics: 'Сейчас влияет на повествование и может быть снят со временем вне боя.',
  },
  blinded: {
    label: 'Ослепление',
    icon: '◐',
    description: 'Герой плохо видит окружение и уязвим к неожиданностям.',
    mechanics: 'Сейчас влияет на повествование и может быть снято со временем вне боя.',
  },
  blessed: {
    label: 'Благословение',
    icon: '✦',
    description: 'Светлая сила поддерживает героя в бою.',
    mechanics: 'Добавляет 1к4 к броску атаки, пока эффект активен.',
  },
  hasted: {
    label: 'Ускорение',
    icon: '»',
    description: 'Движения становятся резче, а реакция быстрее.',
    mechanics: 'Сейчас влияет на повествование и может быть снято со временем вне боя.',
  },
};

export function effectNameRu(type: StatusEffectType): string {
  return STATUS_EFFECT_META[type]?.label ?? type;
}
