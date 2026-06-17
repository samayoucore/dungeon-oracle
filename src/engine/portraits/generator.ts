// ============================================================================
// Deterministic procedural portraits (Phase 12). A seed always yields the same
// stylised identicon-like spec. Pure functions — no React, no store.
// ============================================================================

function hashString(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export type PortraitShape = 'round' | 'angular' | 'narrow';
export type PortraitSymbol =
  | 'sword' | 'dagger' | 'staff' | 'symbol' | 'bow' | 'lute'
  | 'coin' | 'shield' | 'book' | 'leaf';

export interface PortraitSpec {
  shape: PortraitShape;
  skinTone: string;
  accentColor: string;
  symbol: PortraitSymbol;
}

const SHAPES: PortraitShape[] = ['round', 'angular', 'narrow'];
const ACCENTS = ['#c9a227', '#7c3aed', '#16a34a', '#0ea5e9', '#8b1a1a'];
const SKIN_TONES = ['#e8c4a0', '#c68642', '#8d5524', '#f0d5b8', '#a86f4d'];

const ROLE_SYMBOLS: Record<string, PortraitSymbol> = {
  fighter: 'sword',
  rogue: 'dagger',
  wizard: 'staff',
  cleric: 'symbol',
  ranger: 'bow',
  bard: 'lute',
  merchant: 'coin',
  торговец: 'coin',
  guard: 'shield',
  страж: 'shield',
  стражник: 'shield',
  scholar: 'book',
  учёный: 'book',
  default: 'leaf',
};

export function generatePortrait(seed: string, roleOrClass?: string): PortraitSpec {
  const h = hashString(seed);
  return {
    shape: SHAPES[h % SHAPES.length],
    skinTone: SKIN_TONES[(h >> 2) % SKIN_TONES.length],
    accentColor: ACCENTS[(h >> 4) % ACCENTS.length],
    symbol: ROLE_SYMBOLS[(roleOrClass ?? 'default').toLowerCase()] ?? ROLE_SYMBOLS.default,
  };
}
