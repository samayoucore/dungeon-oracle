// ============================================================================
// Per-location-type background gradient + glow accent (Phase 12). Pure mapping.
// ============================================================================

import type { LocationType } from '../../types';

export interface LocationTheme {
  background: string;
  glow: string;
}

const THEMES: Record<LocationType, LocationTheme> = {
  crypt: { background: 'radial-gradient(ellipse at 50% 0%, #1a2233 0%, #0d1117 70%)', glow: '#7c3aed' },
  cave: { background: 'radial-gradient(ellipse at 50% 0%, #1c1f17 0%, #0d1117 70%)', glow: '#94a3b8' },
  library: { background: 'radial-gradient(ellipse at 50% 0%, #241b12 0%, #0d1117 70%)', glow: '#c9a227' },
  shrine: { background: 'radial-gradient(ellipse at 50% 0%, #1a2a22 0%, #0d1117 70%)', glow: '#16a34a' },
  town: { background: 'radial-gradient(ellipse at 50% 0%, #2a2015 0%, #0d1117 70%)', glow: '#c9a227' },
  boss_lair: { background: 'radial-gradient(ellipse at 50% 0%, #2a1212 0%, #0d1117 70%)', glow: '#8b1a1a' },
  building_interior: { background: 'radial-gradient(ellipse at 50% 0%, #1f1a14 0%, #0d1117 70%)', glow: '#c9a227' },
  wilderness: { background: 'radial-gradient(ellipse at 50% 0%, #15201a 0%, #0d1117 70%)', glow: '#16a34a' },
  dungeon_room: { background: 'radial-gradient(ellipse at 50% 0%, #181c22 0%, #0d1117 70%)', glow: '#94a3b8' },
  corridor: { background: 'radial-gradient(ellipse at 50% 0%, #15181d 0%, #0d1117 70%)', glow: '#94a3b8' },
  other: { background: 'radial-gradient(ellipse at 50% 0%, #181818 0%, #0d1117 70%)', glow: '#94a3b8' },
};

export function getLocationTheme(type: LocationType): LocationTheme {
  return THEMES[type] ?? THEMES.other;
}
