import { useMemo, useRef, useState } from 'react';
import { Award, Check, LockKeyhole, Move, RotateCcw, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import type { CharacterClass, TalentOption } from '../../types';
import { getTalentTree } from '../../engine/character/talents';

interface TalentTreeProps {
  characterClass: CharacterClass;
  selectedTalentIds: string[];
  currentLevel: number;
  pendingOptions?: TalentOption[];
  onChoose?: (talentId: string) => void;
  height?: number;
}

const CANVAS = { width: 1040, height: 520 };
const NODE = { width: 176, height: 82 };

function effectLabel(option: TalentOption): string {
  switch (option.effect.kind) {
    case 'damage_bonus_low_hp':
      return `Урон при низком HP +${option.effect.amount ?? 0}`;
    case 'damage_reduction':
      return `Снижение урона ${option.effect.amount ?? 0}`;
    case 'crit_range_expand':
      return 'Крит на 19-20';
    case 'heal_on_kill':
      return 'Лечение за добивание';
    default:
      return 'Пассивный талант';
  }
}

function canUse(option: TalentOption, selected: Set<string>, pending: Set<string>): boolean {
  if (!pending.has(option.id) || selected.has(option.id)) return false;
  return (option.requires ?? []).every((id) => selected.has(id));
}

/** Pannable talent tree used both for browsing and level-up selection. */
export default function TalentTree({
  characterClass,
  selectedTalentIds,
  currentLevel,
  pendingOptions = [],
  onChoose,
  height = 390,
}: TalentTreeProps) {
  const nodes = useMemo(() => getTalentTree(characterClass), [characterClass]);
  const selected = useMemo(() => new Set(selectedTalentIds), [selectedTalentIds]);
  const pending = useMemo(() => new Set(pendingOptions.map((option) => option.id)), [pendingOptions]);
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?.id ?? '');
  const [pan, setPan] = useState({ x: 24, y: 18 });
  const [scale, setScale] = useState(0.92);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  const focused = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  const linePairs = nodes.flatMap((node) =>
    (node.requires ?? []).map((req) => {
      const from = nodes.find((candidate) => candidate.id === req);
      return from ? { from, to: node } : null;
    }).filter((pair): pair is { from: TalentOption; to: TalentOption } => pair !== null),
  );

  const resetView = () => {
    setPan({ x: 24, y: 18 });
    setScale(0.92);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
          <Move className="h-4 w-4 text-gold" />
          Дерево можно перетаскивать
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setScale((v) => Math.max(0.65, v - 0.1))} className="icon-button" aria-label="Уменьшить">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setScale((v) => Math.min(1.35, v + 0.1))} className="icon-button" aria-label="Увеличить">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" onClick={resetView} className="icon-button" aria-label="Вернуть вид">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div
          className="talent-tree-viewport relative overflow-hidden rounded-lg border border-white/10 bg-dungeon/65"
          style={{ height }}
          onPointerDown={(event) => {
            drag.current = { x: event.clientX, y: event.clientY, startX: pan.x, startY: pan.y };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setPan({
              x: drag.current.startX + event.clientX - drag.current.x,
              y: drag.current.startY + event.clientY - drag.current.y,
            });
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: CANVAS.width,
              height: CANVAS.height,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            <svg className="pointer-events-none absolute inset-0" width={CANVAS.width} height={CANVAS.height} aria-hidden="true">
              {linePairs.map(({ from, to }) => {
                const active = selected.has(from.id) && selected.has(to.id);
                return (
                  <line
                    key={`${from.id}-${to.id}`}
                    x1={(from.position?.x ?? 0) + NODE.width}
                    y1={(from.position?.y ?? 0) + NODE.height / 2}
                    x2={to.position?.x ?? 0}
                    y2={(to.position?.y ?? 0) + NODE.height / 2}
                    stroke={active ? '#d6aa48' : 'rgba(159,176,189,0.28)'}
                    strokeWidth={active ? 3 : 2}
                  />
                );
              })}
            </svg>

            {nodes.map((node) => {
              const learned = selected.has(node.id);
              const available = canUse(node, selected, pending);
              const lockedByLevel = (node.level ?? 1) > currentLevel && !pending.has(node.id);
              const lockedByReq = !learned && !available && (node.requires ?? []).some((id) => !selected.has(id));
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    if (available && onChoose) onChoose(node.id);
                  }}
                  className={`talent-node absolute text-left ${learned ? 'is-learned' : available ? 'is-available' : 'is-locked'}`}
                  style={{ left: node.position?.x ?? 0, top: node.position?.y ?? 0, width: NODE.width, height: NODE.height }}
                >
                  <span className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0">
                      {learned ? <Check className="h-4 w-4" /> : available ? <Sparkles className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-serif text-sm">{node.name}</span>
                      <span className="block text-[11px] text-muted">Ур. {node.level ?? 1} · {effectLabel(node)}</span>
                    </span>
                  </span>
                  {lockedByLevel && <span className="mt-1 block text-[10px] text-muted">Нужен уровень {node.level}</span>}
                  {lockedByReq && <span className="mt-1 block text-[10px] text-muted">Нужна предыдущая ветка</span>}
                </button>
              );
            })}
          </div>
        </div>

        {focused && (
          <aside className="rounded-lg border border-white/10 bg-dungeon/55 p-3">
            <div className="mb-2 flex items-center gap-2 text-gold">
              <Award className="h-4 w-4" />
              <span className="font-serif text-base">{focused.name}</span>
            </div>
            <div className="text-xs uppercase tracking-wider text-muted">Уровень {focused.level ?? 1}</div>
            <p className="mt-2 text-sm leading-relaxed text-parchment/85">{focused.description}</p>
            <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-2 text-xs text-muted">{effectLabel(focused)}</div>
            {(focused.requires ?? []).length > 0 && (
              <div className="mt-2 text-xs text-muted">
                Требуется: {(focused.requires ?? []).map((id) => nodes.find((node) => node.id === id)?.name ?? id).join(', ')}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
