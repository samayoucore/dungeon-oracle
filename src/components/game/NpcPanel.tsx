import { useGameStore } from '../../store/gameStore';
import type { NPCAttitude } from '../../types';
import Portrait from '../ui/Portrait';

const ATTITUDE_RU: Record<NPCAttitude, { label: string; cls: string }> = {
  hostile: { label: 'Враждебен', cls: 'text-danger' },
  unfriendly: { label: 'Недружелюбен', cls: 'text-orange-400' },
  neutral: { label: 'Нейтрален', cls: 'text-muted' },
  friendly: { label: 'Дружелюбен', cls: 'text-green-400' },
  ally: { label: 'Союзник', cls: 'text-gold' },
};

/** Roster of met NPCs with procedural portraits; those present here float to the top. */
export default function NpcPanel() {
  const npcs = useGameStore((s) => s.npcs);
  const npcMemory = useGameStore((s) => s.npcMemory);
  const locations = useGameStore((s) => s.locations);
  const currentLocationId = useGameStore((s) => s.currentLocationId);

  const all = Object.values(npcs);
  if (all.length === 0) return null;

  const presentIds = new Set((currentLocationId ? locations[currentLocationId]?.npcIds : undefined) ?? []);
  const sorted = [...all].sort((a, b) => (presentIds.has(b.id) ? 1 : 0) - (presentIds.has(a.id) ? 1 : 0));

  return (
    <div className="flex flex-col gap-2 border-t border-surface-elevated pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Знакомые лица</h3>
      {sorted.map((npc) => {
        const attitude = ATTITUDE_RU[npcMemory[npc.id]?.attitude ?? 'neutral'];
        const here = presentIds.has(npc.id);
        return (
          <div
            key={npc.id}
            className={`flex items-center gap-2 rounded-md border p-2 ${
              here ? 'border-gold/40 bg-surface-elevated/40' : 'border-surface-elevated bg-dungeon/40'
            }`}
          >
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-elevated">
              <Portrait seed={npc.id} roleOrClass={npc.role} size={40} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate font-serif text-sm text-parchment">{npc.name}</span>
                {here && <span className="shrink-0 rounded bg-gold/20 px-1 text-[9px] text-gold">здесь</span>}
              </div>
              <div className="truncate text-[11px] text-muted">{npc.role}</div>
              <div className="flex items-center gap-1 text-[11px]">
                <span className={attitude.cls}>{attitude.label}</span>
                {npc.shopInventory?.length ? <span className="text-gold">· 🛒 торговец</span> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
