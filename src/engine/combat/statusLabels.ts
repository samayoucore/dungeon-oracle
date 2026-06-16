// ============================================================================
// Player-facing status-effect labels with emoji. Shared between the combat
// engine (out-of-combat status tick) and the store (DM-applied effects).
// ============================================================================

import type { StatusEffectType } from '../../types';

export const EFFECT_NAME_RU: Record<StatusEffectType, string> = {
  poisoned: 'Отравлен 🐍',
  stunned: 'Оглушён ⚡',
  burning: 'Горит 🔥',
  bleeding: 'Кровотечение 🩸',
  frightened: 'Испуган 😨',
  blinded: 'Ослеплён 🌫',
  blessed: 'Благословлён ✨',
  hasted: 'Ускорен 💨',
};

export function effectNameRu(type: StatusEffectType): string {
  return EFFECT_NAME_RU[type] ?? type;
}
