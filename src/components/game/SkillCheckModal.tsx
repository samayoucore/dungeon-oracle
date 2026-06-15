import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { rollRaw } from '../../engine/combat/dice';
import { STAT_LABELS_RU } from '../../engine/character/data';
import { useSound } from '../../hooks/useSound';
import DiceRoller from './DiceRoller';
import type { DiceOutcome } from './DiceRoller';

interface RollState {
  d20: number;
  mod: number;
  total: number;
  success: boolean;
  outcome: DiceOutcome;
}

/** Modal for a DM-requested out-of-combat skill check (d20 + stat mod vs DC). */
export default function SkillCheckModal() {
  const pending = useGameStore((s) => s.pendingRoll);
  const character = useGameStore((s) => s.character);
  const resolveSkillCheck = useGameStore((s) => s.resolveSkillCheck);
  const { play } = useSound();

  const [roll, setRoll] = useState<RollState | null>(null);
  const [busy, setBusy] = useState(false);

  if (!pending || !character) return null;

  const statLabel = STAT_LABELS_RU[pending.stat];
  const mod = character.modifiers[pending.stat];

  const doRoll = () => {
    const d20 = rollRaw(20);
    const total = d20 + mod;
    const success = total >= pending.dc;
    const outcome: DiceOutcome = d20 === 20 ? 'crit' : d20 === 1 ? 'fail' : success ? 'hit' : 'miss';
    play('dice_roll');
    setRoll({ d20, mod, total, success, outcome });
  };

  const doContinue = () => {
    if (!roll) return;
    setBusy(true);
    void resolveSkillCheck(roll.total, roll.success);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm rounded-lg border border-gold/40 bg-surface p-6 text-center"
      >
        <h2 className="mb-1 font-serif text-xl text-gold">Проверка навыка</h2>
        <p className="mb-4 text-sm text-parchment/80">{pending.description}</p>

        <div className="mb-4 flex items-center justify-center gap-4 text-sm text-muted">
          <span>
            Характеристика: <span className="text-parchment">{statLabel}</span> ({mod >= 0 ? `+${mod}` : mod})
          </span>
          <span>
            Сложность: <span className="text-gold">{pending.dc}</span>
          </span>
        </div>

        <div className="mb-4 flex min-h-[88px] items-center justify-center">
          <DiceRoller result={roll?.d20 ?? null} sides={20} outcome={roll?.outcome} />
        </div>

        {roll && (
          <p className={`mb-4 text-sm ${roll.success ? 'text-green-400' : 'text-danger'}`}>
            {roll.d20} {roll.mod >= 0 ? `+ ${roll.mod}` : `− ${Math.abs(roll.mod)}`} = <b>{roll.total}</b> против {pending.dc} —{' '}
            {roll.success ? 'УСПЕХ' : 'ПРОВАЛ'}
          </p>
        )}

        {!roll ? (
          <button
            type="button"
            onClick={doRoll}
            className="rounded-md bg-gold px-5 py-2 text-sm font-medium text-dungeon transition-colors hover:bg-gold/90"
          >
            🎲 Бросить к20
          </button>
        ) : (
          <button
            type="button"
            onClick={doContinue}
            disabled={busy}
            className="rounded-md border border-surface-elevated px-5 py-2 text-sm text-parchment transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Мастер описывает исход…' : 'Продолжить'}
          </button>
        )}
      </motion.div>
    </div>
  );
}
