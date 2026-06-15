import { useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { Location } from '../../types';
import { LOCATION_ICON, LOCATION_LABEL } from './locationMeta';

/** Vertical list of discovered locations, replacing the old canvas dungeon map. */
export default function LocationAtlas() {
  const locations = useGameStore((s) => s.locations);
  const currentLocationId = useGameStore((s) => s.currentLocationId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ordered = useMemo(
    () => Object.values(locations).sort((a, b) => a.discoveredAt - b.discoveredAt),
    [locations],
  );

  if (ordered.length === 0) {
    return <p className="text-sm text-muted">Мир ещё не открыт…</p>;
  }

  return (
    <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto pr-1">
      {ordered.map((loc) => {
        const isCurrent = loc.id === currentLocationId;
        const open = isCurrent || expandedId === loc.id;
        return (
          <AtlasCard
            key={loc.id}
            loc={loc}
            isCurrent={isCurrent}
            open={open}
            locations={locations}
            onToggle={() => setExpandedId(expandedId === loc.id ? null : loc.id)}
          />
        );
      })}
    </div>
  );
}

interface AtlasCardProps {
  loc: Location;
  isCurrent: boolean;
  open: boolean;
  locations: Record<string, Location>;
  onToggle: () => void;
}

function AtlasCard({ loc, isCurrent, open, locations, onToggle }: AtlasCardProps) {
  return (
    <div
      className={`rounded-md border p-2 transition-colors ${
        isCurrent ? 'border-gold bg-surface-elevated/60' : 'border-surface-elevated bg-dungeon/40'
      }`}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 text-left">
        <span className="text-lg">{LOCATION_ICON[loc.type]}</span>
        <span className="flex-1">
          <span className="block font-serif text-sm text-parchment">{loc.name}</span>
          <span className="block text-xs capitalize text-muted">{LOCATION_LABEL[loc.type]}</span>
        </span>
        {isCurrent && <span className="shrink-0 animate-pulse rounded bg-gold/20 px-1.5 py-0.5 text-[10px] text-gold">Текущая</span>}
      </button>

      {loc.isSafeZone && <p className="mt-1 text-[11px] text-green-400">🛡 Безопасная зона</p>}

      {open && (
        <div className="mt-1.5 border-t border-surface-elevated/60 pt-1.5">
          <p className="text-xs leading-relaxed text-parchment/80">{loc.description}</p>
          {loc.lore && <p className="mt-1 text-[11px] italic leading-relaxed text-muted">{loc.lore}</p>}
          {loc.connections.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {loc.connections.map((cn, i) => (
                <li key={`${cn.toLocationId}-${i}`} className="text-[11px] text-muted">
                  → {cn.label}: <span className="text-parchment/70">{locations[cn.toLocationId]?.name ?? '???'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
