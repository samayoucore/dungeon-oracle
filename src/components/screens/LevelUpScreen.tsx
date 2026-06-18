import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import type { LevelUpInfo } from '../../types';
import { useSound } from '../../hooks/useSound';
import { useGameStore } from '../../store/gameStore';
import TalentTree from '../character/TalentTree';

interface LevelUpScreenProps {
  info: LevelUpInfo;
  onClose: () => void;
}

interface Particle {
  id: number;
  angle: number;
  distance: number;
  color: string;
  size: number;
}

const BURST_COLORS = ['#c9a227', '#7c3aed'];

function makeParticles(): Particle[] {
  return Array.from({ length: 26 }, (_, id) => ({
    id,
    angle: Math.random() * Math.PI * 2,
    distance: 60 + Math.random() * 130,
    color: BURST_COLORS[id % BURST_COLORS.length],
    size: 4 + Math.random() * 6,
  }));
}

/** Modal celebrating a level-up. Closes only via the Continue button. */
export default function LevelUpScreen({ info, onClose }: LevelUpScreenProps) {
  const particles = useMemo(makeParticles, []);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { play } = useSound();
  const pendingTalentChoices = useGameStore((s) => s.pendingTalentChoices);
  const chooseTalent = useGameStore((s) => s.chooseTalent);
  const character = useGameStore((s) => s.character);
  const talentChoice = pendingTalentChoices.find((t) => t.level === info.newLevel);
  useEffect(() => {
    play('level_up');
  }, [play]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-4xl overflow-hidden rounded-xl border border-gold/40 bg-surface p-6 text-center"
      >
        <div className="pointer-events-none absolute left-1/2 top-16">
          {particles.map((p) => (
            <motion.span
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{ x: Math.cos(p.angle) * p.distance, y: Math.sin(p.angle) * p.distance, opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="absolute rounded-full"
              style={{ width: p.size, height: p.size, backgroundColor: p.color }}
            />
          ))}
        </div>

        <h2 className="levelup-glow relative font-serif text-5xl font-bold text-gold">ПОВЫШЕНИЕ</h2>
        <div className="relative mt-2 text-xl text-parchment">
          {info.oldLevel} → <span className="text-gold">{info.newLevel}</span>
        </div>

        <div className="relative my-4">
          <div className="text-2xl font-bold text-[#16a34a]">+{info.hpGained} HP</div>
          <div className="text-xs text-muted">Макс. HP: {info.oldMaxHp} → {info.newMaxHp}</div>
        </div>

        {info.features.length > 0 && (
          <div className="relative mb-4 flex flex-col gap-2 text-left">
            {info.features.map((feature) => (
              <div key={feature} className="rounded-md border border-gold/30 bg-dungeon/40 p-2 text-sm text-parchment">
                ✦ {feature}
              </div>
            ))}
          </div>
        )}

        {info.newProf > info.oldProf && (
          <div className="relative mb-4 text-sm text-gold">
            Бонус владения: +{info.oldProf} → +{info.newProf}
          </div>
        )}

        {talentChoice && (
          <div className="relative mb-4 text-left">
            <div className="mb-2 text-sm font-semibold text-gold">Выбери талант:</div>
            {character && (
              <TalentTree
                characterClass={character.class}
                selectedTalentIds={character.talents}
                currentLevel={info.newLevel}
                pendingOptions={talentChoice.options}
                onChoose={(talentId) => chooseTalent(talentChoice.level, talentId)}
                height={330}
              />
            )}
          </div>
        )}

        <button
          ref={buttonRef}
          type="button"
          onClick={onClose}
          disabled={!!talentChoice}
          className="relative w-full rounded-md bg-gold px-4 py-3 font-semibold text-dungeon transition-colors hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {talentChoice ? 'Сначала выбери талант' : 'Продолжить приключение'}
        </button>
      </motion.div>
    </div>
  );
}
