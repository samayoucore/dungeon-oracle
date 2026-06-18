import { Bed, Ear, Eye, Search, Sparkles } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';

interface WorldAction {
  label: string;
  hint: string;
  command: string;
  icon: typeof Eye;
}

const ACTIONS: WorldAction[] = [
  { label: 'Осмотреть', hint: 'детали сцены', command: 'Осмотреться вокруг.', icon: Eye },
  { label: 'Обыскать', hint: 'быстрая находка', command: 'Обыскать местность в поисках чего-нибудь полезного.', icon: Search },
  { label: 'Отдохнуть', hint: 'восстановить силы', command: 'Отдохнуть и перевести дух.', icon: Bed },
  { label: 'Слушать', hint: 'подсказки мира', command: 'Прислушаться к окружению.', icon: Ear },
  { label: 'Скачок', hint: 'новое место', command: 'Магическим образом оказаться в безопасной таверне.', icon: Sparkles },
];

export default function WorldActionPanel() {
  const isLoading = useGameStore((s) => s.isLoading);
  const inCombat = useGameStore((s) => !!s.combat?.active);
  const pendingRoll = useGameStore((s) => s.pendingRoll);
  const submitPlayerAction = useGameStore((s) => s.submitPlayerAction);
  const locked = isLoading || inCombat || !!pendingRoll;

  return (
    <div className="grid grid-cols-2 gap-2">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            disabled={locked}
            onClick={() => void submitPlayerAction(action.command)}
            className="action-tile group min-h-[70px] rounded-lg border border-white/10 bg-white/5 p-3 text-left transition hover:border-gold/70 hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-parchment">
              <Icon className="h-4 w-4 text-gold transition group-hover:scale-110" />
              {action.label}
            </span>
            <span className="mt-1 block text-xs text-muted">{action.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
