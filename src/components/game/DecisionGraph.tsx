import type { DecisionLogEntry } from '../../types';

interface DecisionGraphProps {
  entries: DecisionLogEntry[];
}

const SPINE_X = 24;
const WIDTH = 360;
const ROW = 60;
const CONSEQUENCE_EXTRA = 34;
const GOLD = '#c9a227';
const MAGIC = '#7c3aed';

/** Pure SVG vertical timeline of major decisions, with consequence branches. */
export default function DecisionGraph({ entries }: DecisionGraphProps) {
  if (entries.length === 0) return null;

  let cursor = 26;
  const nodes = entries.map((e) => {
    const nodeY = cursor + 10;
    const consY = nodeY + 30;
    cursor += ROW + (e.consequence ? CONSEQUENCE_EXTRA : 0);
    return { e, nodeY, consY };
  });
  const height = cursor + 12;
  const firstY = nodes[0].nodeY;
  const lastY = nodes[nodes.length - 1].nodeY;

  return (
    <svg width="100%" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label="Граф решений" className="max-w-full">
      <line x1={SPINE_X} y1={firstY} x2={SPINE_X} y2={lastY} stroke="#2a2f3a" strokeWidth={2} />
      {nodes.map(({ e, nodeY, consY }) => (
        <g key={e.id}>
          {e.consequence && (
            <>
              <line x1={SPINE_X} y1={nodeY} x2={SPINE_X + 22} y2={consY} stroke={MAGIC} strokeWidth={1.5} />
              <circle cx={SPINE_X + 22} cy={consY} r={4} fill={MAGIC} />
            </>
          )}
          <circle cx={SPINE_X} cy={nodeY} r={7} fill={GOLD} stroke="#0d1117" strokeWidth={2} />
          <foreignObject x={SPINE_X + 16} y={nodeY - 16} width={WIDTH - SPINE_X - 24} height={34}>
            <div className="leading-tight">
              <div className="truncate text-xs text-parchment">{e.description}</div>
              <div className="text-[10px] text-muted">ход {e.turn} · {e.locationName}</div>
            </div>
          </foreignObject>
          {e.consequence && (
            <foreignObject x={SPINE_X + 34} y={consY - 10} width={WIDTH - SPINE_X - 44} height={24}>
              <div className="truncate text-[11px] italic text-magic">↳ {e.consequence}</div>
            </foreignObject>
          )}
        </g>
      ))}
    </svg>
  );
}
