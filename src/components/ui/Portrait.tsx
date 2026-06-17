import { useMemo } from 'react';
import { generatePortrait } from '../../engine/portraits/generator';
import type { PortraitSymbol } from '../../engine/portraits/generator';

interface PortraitProps {
  seed: string;
  roleOrClass?: string;
  size?: number;
}

/** Tiny abstract line-glyph for the role badge, centred at (cx, cy). */
function SymbolGlyph({ symbol, cx, cy, r, stroke }: { symbol: PortraitSymbol; cx: number; cy: number; r: number; stroke: string }) {
  const sw = Math.max(1, r * 0.22);
  const common = { stroke, strokeWidth: sw, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (symbol) {
    case 'sword':
      return (
        <g {...common}>
          <line x1={cx} y1={cy - r} x2={cx} y2={cy + r * 0.6} />
          <line x1={cx - r * 0.5} y1={cy + r * 0.2} x2={cx + r * 0.5} y2={cy + r * 0.2} />
        </g>
      );
    case 'dagger':
      return (
        <g {...common}>
          <line x1={cx} y1={cy - r * 0.7} x2={cx} y2={cy + r * 0.7} />
          <line x1={cx - r * 0.4} y1={cy + r * 0.3} x2={cx + r * 0.4} y2={cy + r * 0.3} />
        </g>
      );
    case 'staff':
      return (
        <g {...common}>
          <line x1={cx} y1={cy - r * 0.3} x2={cx} y2={cy + r * 0.8} />
          <circle cx={cx} cy={cy - r * 0.6} r={r * 0.32} />
        </g>
      );
    case 'symbol':
      return (
        <g {...common}>
          <line x1={cx} y1={cy - r * 0.8} x2={cx} y2={cy + r * 0.8} />
          <line x1={cx - r * 0.6} y1={cy - r * 0.2} x2={cx + r * 0.6} y2={cy - r * 0.2} />
        </g>
      );
    case 'bow':
      return (
        <g {...common}>
          <path d={`M ${cx + r * 0.4} ${cy - r * 0.8} A ${r} ${r} 0 0 0 ${cx + r * 0.4} ${cy + r * 0.8}`} />
          <line x1={cx + r * 0.4} y1={cy - r * 0.8} x2={cx + r * 0.4} y2={cy + r * 0.8} />
        </g>
      );
    case 'lute':
      return (
        <g {...common}>
          <circle cx={cx - r * 0.2} cy={cy + r * 0.3} r={r * 0.45} />
          <line x1={cx} y1={cy + r * 0.1} x2={cx + r * 0.6} y2={cy - r * 0.7} />
        </g>
      );
    case 'coin':
      return (
        <g {...common}>
          <circle cx={cx} cy={cy} r={r * 0.7} />
          <circle cx={cx} cy={cy} r={r * 0.12} fill={stroke} stroke="none" />
        </g>
      );
    case 'shield':
      return (
        <g {...common}>
          <path d={`M ${cx} ${cy - r * 0.8} L ${cx + r * 0.7} ${cy - r * 0.4} L ${cx + r * 0.5} ${cy + r * 0.6} L ${cx} ${cy + r * 0.85} L ${cx - r * 0.5} ${cy + r * 0.6} L ${cx - r * 0.7} ${cy - r * 0.4} Z`} />
        </g>
      );
    case 'book':
      return (
        <g {...common}>
          <rect x={cx - r * 0.7} y={cy - r * 0.6} width={r * 1.4} height={r * 1.2} rx={r * 0.1} />
          <line x1={cx} y1={cy - r * 0.6} x2={cx} y2={cy + r * 0.6} />
        </g>
      );
    case 'leaf':
    default:
      return (
        <g {...common}>
          <path d={`M ${cx} ${cy - r * 0.8} C ${cx + r} ${cy - r * 0.4}, ${cx + r * 0.4} ${cy + r * 0.8}, ${cx} ${cy + r * 0.8} C ${cx - r * 0.4} ${cy + r * 0.8}, ${cx - r} ${cy - r * 0.4}, ${cx} ${cy - r * 0.8} Z`} />
        </g>
      );
  }
}

/** Deterministic procedural portrait (identicon-style). Pure presentational. */
export default function Portrait({ seed, roleOrClass, size = 48 }: PortraitProps) {
  const spec = useMemo(() => generatePortrait(seed, roleOrClass), [seed, roleOrClass]);
  const c = size / 2;
  const r = size * 0.4;

  const base =
    spec.shape === 'round' ? (
      <circle cx={c} cy={c} r={r} fill={spec.skinTone} stroke={spec.accentColor} strokeWidth={size * 0.05} />
    ) : spec.shape === 'angular' ? (
      <rect
        x={c - r * 0.85}
        y={c - r * 0.85}
        width={r * 1.7}
        height={r * 1.7}
        rx={r * 0.22}
        fill={spec.skinTone}
        stroke={spec.accentColor}
        strokeWidth={size * 0.05}
        transform={`rotate(45 ${c} ${c})`}
      />
    ) : (
      <ellipse cx={c} cy={c} rx={r * 0.72} ry={r} fill={spec.skinTone} stroke={spec.accentColor} strokeWidth={size * 0.05} />
    );

  const badgeR = size * 0.16;
  const bx = size - badgeR - size * 0.04;
  const by = size - badgeR - size * 0.04;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Портрет">
      {base}
      {/* Accent "hair/hood" arc across the upper area. */}
      <path
        d={`M ${c - r * 0.7} ${c - r * 0.15} A ${r * 0.75} ${r * 0.55} 0 0 1 ${c + r * 0.7} ${c - r * 0.15}`}
        stroke={spec.accentColor}
        strokeWidth={size * 0.12}
        fill="none"
        strokeLinecap="round"
        opacity={0.85}
      />
      {/* Role badge. */}
      <circle cx={bx} cy={by} r={badgeR} fill={spec.accentColor} stroke="#0d1117" strokeWidth={size * 0.03} />
      <SymbolGlyph symbol={spec.symbol} cx={bx} cy={by} r={badgeR * 0.62} stroke="#0d1117" />
    </svg>
  );
}
