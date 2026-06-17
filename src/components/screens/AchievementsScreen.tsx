import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownToLine,
  Award,
  Coins,
  Drama,
  HeartCrack,
  Hourglass,
  ScrollText,
  Skull,
  Sparkles,
  Sword,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { ACHIEVEMENTS } from '../../engine/world/achievements';

interface AchievementsScreenProps {
  onClose: () => void;
}

const ICONS: Record<string, LucideIcon> = {
  Sword,
  HeartCrack,
  Coins,
  Drama,
  ArrowDownToLine,
  ScrollText,
  Users,
  Skull,
  Sparkles,
  Hourglass,
};

/** Modal trophy gallery. Locked achievements are dimmed with hidden details. */
export default function AchievementsScreen({ onClose }: AchievementsScreenProps) {
  const unlocked = useGameStore((s) => s.unlockedAchievements);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const unlockedCount = ACHIEVEMENTS.filter((a) => unlocked.includes(a.id)).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-surface-elevated bg-surface"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-surface-elevated px-5 py-3">
          <h2 className="font-serif text-xl text-gold">
            Достижения <span className="text-sm text-muted">({unlockedCount}/{ACHIEVEMENTS.length})</span>
          </h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="text-muted transition-colors hover:text-gold">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const isUnlocked = unlocked.includes(a.id);
            const Icon = ICONS[a.icon] ?? Award;
            return (
              <div
                key={a.id}
                className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                  isUnlocked ? 'border-gold/40 bg-dungeon/40' : 'border-surface-elevated bg-surface-elevated/30 opacity-40 grayscale'
                }`}
              >
                <Icon className={`h-6 w-6 shrink-0 ${isUnlocked ? 'text-gold' : 'text-muted'}`} />
                <div className="min-w-0">
                  <div className="font-serif text-sm text-parchment">{a.title}</div>
                  <div className="text-xs text-muted">{isUnlocked ? a.description : '???'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
