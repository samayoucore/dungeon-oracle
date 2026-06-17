import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import DecisionGraph from '../game/DecisionGraph';

interface ChronicleScreenProps {
  onClose: () => void;
}

function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-dungeon/60 p-2 text-center">
      <div className="text-base font-bold text-parchment">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

/** Modal chronicle: story summary, key-moment timeline, stats, decision graph. */
export default function ChronicleScreen({ onClose }: ChronicleScreenProps) {
  const storySummary = useGameStore((s) => s.storySummary);
  const narrativeLog = useGameStore((s) => s.narrativeLog);
  const stats = useGameStore((s) => s.gameStats);
  const decisionLog = useGameStore((s) => s.decisionLog);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const keyMoments = narrativeLog.filter((e) => (e.type === 'quest' || e.type === 'system') && e.text.includes('✦'));

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
          <h2 className="font-serif text-xl text-gold">Хроника приключения</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="text-muted transition-colors hover:text-gold">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto p-5">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">До этого момента</h3>
            <div
              className="rounded-md border border-gold/20 p-4 font-serif italic leading-relaxed text-parchment/90"
              style={{ background: 'rgba(201, 162, 39, 0.06)' }}
            >
              {storySummary || 'Приключение только начинается — здесь появится сводка пути после первых значимых событий.'}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Ключевые моменты</h3>
            {keyMoments.length === 0 ? (
              <p className="text-sm text-muted">Пока ничего значимого не произошло.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {keyMoments.map((m) => (
                  <li key={m.id} className="flex items-start gap-2 text-sm text-parchment/90">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <span>{m.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {decisionLog.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Граф решений</h3>
              <DecisionGraph entries={decisionLog} />
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Статистика</h3>
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="Ходов" value={stats.turnsPlayed} />
              <StatCell label="Врагов" value={stats.enemiesKilled} />
              <StatCell label="Локаций" value={stats.roomsExplored} />
              <StatCell label="Золота" value={stats.goldFound} />
              <StatCell label="Квестов" value={stats.questsCompleted} />
              <StatCell label="Смертей" value={stats.deathCount} />
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
