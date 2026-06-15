import { ChevronRight } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useSound } from '../../hooks/useSound';
import { LOCATION_ICON } from './locationMeta';

interface ExitPanelProps {
  /** Movement is locked during combat / while the DM is thinking. */
  disabled?: boolean;
}

/** Lists the known passages from the current location as DM action shortcuts. */
export default function ExitPanel({ disabled = false }: ExitPanelProps) {
  const locations = useGameStore((s) => s.locations);
  const currentLocationId = useGameStore((s) => s.currentLocationId);
  const submitPlayerAction = useGameStore((s) => s.submitPlayerAction);
  const { play } = useSound();

  const current = currentLocationId ? locations[currentLocationId] : null;
  if (!current) return null;

  const handleMove = (label: string, targetName: string) => {
    play('footstep');
    void submitPlayerAction(`Я иду ${label} — в сторону «${targetName}».`);
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Выходы</h3>

      {current.connections.length === 0 ? (
        <p className="text-sm italic text-muted">
          Опиши, куда ты хочешь отправиться — Мастер Подземелий откроет путь.
        </p>
      ) : (
        current.connections.map((cn, i) => {
          const target = locations[cn.toLocationId];
          const targetName = target?.name ?? 'неизвестность';
          return (
            <button
              key={`${cn.toLocationId}-${i}`}
              type="button"
              disabled={disabled}
              onClick={() => handleMove(cn.label, targetName)}
              className="group flex items-center gap-3 rounded-md border border-surface-elevated bg-dungeon/40 px-3 py-2 text-left transition-colors hover:border-gold hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-surface-elevated"
            >
              <span className="text-lg">{target ? LOCATION_ICON[target.type] : '❓'}</span>
              <span className="flex-1 text-sm text-parchment">
                {cn.label}
                <span className="ml-1 text-xs text-muted">→ {targetName}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-gold" />
            </button>
          );
        })
      )}
    </div>
  );
}
