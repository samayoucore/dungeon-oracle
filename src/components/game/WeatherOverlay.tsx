import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { WeatherEffect } from '../../engine/world/weatherMap';

interface WeatherOverlayProps {
  effect: WeatherEffect;
}

type Shape = 'line' | 'dot' | 'fog';

interface EffectConfig {
  count: number;
  keyframe: string;
  color: string;
  minDur: number;
  maxDur: number;
  shape: Shape;
  timing: string;
}

// Loops are pure CSS keyframes (see index.css) — never framer-motion — so the
// perpetual animation can't interfere with AnimatePresence exit tracking.
const CONFIG: Record<Exclude<WeatherEffect, 'none'>, EffectConfig> = {
  rain: { count: 28, keyframe: 'weather-rain', color: '#aab6c8', minDur: 0.7, maxDur: 1.4, shape: 'line', timing: 'linear' },
  fog: { count: 9, keyframe: 'weather-fog', color: '#94a3b8', minDur: 16, maxDur: 28, shape: 'fog', timing: 'linear' },
  embers: { count: 24, keyframe: 'weather-ember', color: '#e0b84a', minDur: 4, maxDur: 8, shape: 'dot', timing: 'ease-out' },
  snow: { count: 26, keyframe: 'weather-snow', color: '#f0e4cc', minDur: 6, maxDur: 11, shape: 'dot', timing: 'ease-in-out' },
  dust: { count: 22, keyframe: 'weather-snow', color: '#bdb3a3', minDur: 9, maxDur: 16, shape: 'dot', timing: 'ease-in-out' },
};

interface Particle {
  id: number;
  style: CSSProperties;
}

function buildParticles(effect: Exclude<WeatherEffect, 'none'>): Particle[] {
  const cfg = CONFIG[effect];
  return Array.from({ length: cfg.count }, (_, id) => {
    const duration = cfg.minDur + Math.random() * (cfg.maxDur - cfg.minDur);
    const delay = -Math.random() * cfg.maxDur; // negative delay = already in flight
    const animation = `${cfg.keyframe} ${duration}s ${cfg.timing} ${delay}s infinite`;
    let style: CSSProperties;
    if (cfg.shape === 'line') {
      style = { left: `${Math.random() * 100}%`, width: 2, height: 14 + Math.random() * 6, backgroundColor: cfg.color, animation };
    } else if (cfg.shape === 'fog') {
      style = {
        top: `${Math.random() * 100}%`,
        width: 80 + Math.random() * 70,
        height: 40 + Math.random() * 30,
        borderRadius: '50%',
        backgroundColor: cfg.color,
        filter: 'blur(14px)',
        animation,
      };
    } else {
      const s = 3 + Math.random() * 2;
      style = { left: `${Math.random() * 100}%`, width: s, height: s, borderRadius: '50%', backgroundColor: cfg.color, animation };
    }
    return { id, style };
  });
}

/** Pure presentational atmospheric particle layer for the current location. */
export default function WeatherOverlay({ effect }: WeatherOverlayProps) {
  const particles = useMemo(() => (effect === 'none' ? [] : buildParticles(effect)), [effect]);
  if (effect === 'none') return null;
  return (
    // z-20: above the game panels (z-10) but below combat/modals (z-50+).
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {particles.map((p) => (
        <span key={p.id} className="absolute" style={p.style} />
      ))}
    </div>
  );
}
