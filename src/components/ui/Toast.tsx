import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { ACHIEVEMENT_BY_ID } from '../../engine/world/achievements';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error';
}

/** Small toast queue with auto-dismiss. */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, type: ToastItem['type'] = 'success', duration = 2000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  return { toasts, push };
}

/** Stacked toast notifications, bottom-right — plus the achievement queue. */
export default function Toast({ toasts }: { toasts: ToastItem[] }) {
  const pending = useGameStore((s) => s.pendingAchievementToasts);
  const dynamicAchievements = useGameStore((s) => s.dynamicAchievements);
  const consume = useGameStore((s) => s.consumeAchievementToast);
  const currentId = pending[0];
  const achievement = currentId ? ACHIEVEMENT_BY_ID[currentId] ?? dynamicAchievements.find((item) => item.id === currentId) : undefined;

  useEffect(() => {
    if (!currentId) return;
    const timer = window.setTimeout(() => consume(), 3000);
    return () => window.clearTimeout(timer);
  }, [currentId, consume]);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex flex-col gap-2">
      {achievement && (
        <motion.div
          key={currentId}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-2 rounded-md border border-gold bg-surface px-3 py-2 text-sm text-parchment shadow-lg"
        >
          <Trophy className="h-4 w-4 shrink-0 text-gold" />
          <span>
            Достижение получено: <b className="text-gold">{achievement.title}</b>
          </span>
        </motion.div>
      )}
      {toasts.map((toast) => (
        <motion.div
          key={toast.id}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`rounded-md px-3 py-2 text-sm shadow-lg ${
            toast.type === 'success' ? 'bg-surface-elevated text-parchment' : 'bg-danger text-parchment'
          }`}
        >
          {toast.message}
        </motion.div>
      ))}
    </div>
  );
}
