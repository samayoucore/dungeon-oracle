// ============================================================================
// Deterministic illustrated portraits. A seed always yields the same character
// bust, but the output is shaped by race/class so it reads as a person, not an
// abstract identicon.
// ============================================================================

import type { CharacterRace } from '../../types';

function hashString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(items: readonly T[], hash: number, shift: number): T {
  return items[(hash >> shift) % items.length];
}

export type PortraitHair = 'cropped' | 'waves' | 'braids' | 'hood' | 'wild';
export type PortraitExpression = 'calm' | 'stern' | 'bright';
export type PortraitTrait = 'none' | 'elf-ears' | 'beard' | 'tusks' | 'horns' | 'soft-ears';

export interface PortraitSpec {
  skinTone: string;
  hairColor: string;
  eyeColor: string;
  accentColor: string;
  cloakColor: string;
  background: string;
  hair: PortraitHair;
  expression: PortraitExpression;
  trait: PortraitTrait;
  faceWidth: number;
  faceHeight: number;
}

const SKIN_TONES = ['#f0c7a2', '#d99b6c', '#a86f4d', '#7b4a35', '#c7a1d8', '#b87c6b'];
const HAIR_COLORS = ['#19100d', '#3d2415', '#6d3d1f', '#c9a66b', '#c8c0b0', '#7b1e2b'];
const EYE_COLORS = ['#d7b35a', '#73b6a2', '#9bb7e0', '#c06c84', '#d8e36b'];
const BACKGROUNDS = ['#17202a', '#211827', '#16251f', '#251c15', '#241818'];

const CLASS_ACCENTS: Record<string, string> = {
  fighter: '#d8a657',
  rogue: '#7dd3fc',
  wizard: '#a78bfa',
  cleric: '#f5d56e',
  ranger: '#6ee7a8',
  bard: '#f0abfc',
  default: '#d8a657',
};

const CLASS_CLOAKS: Record<string, string> = {
  fighter: '#59403a',
  rogue: '#1f2a44',
  wizard: '#302052',
  cleric: '#3f3f34',
  ranger: '#1f3a2f',
  bard: '#4b2446',
  default: '#2d3440',
};

function traitForRace(race?: CharacterRace): PortraitTrait {
  switch (race) {
    case 'elf':
      return 'elf-ears';
    case 'dwarf':
      return 'beard';
    case 'half-orc':
      return 'tusks';
    case 'tiefling':
      return 'horns';
    case 'halfling':
      return 'soft-ears';
    case 'human':
    default:
      return 'none';
  }
}

export function generatePortrait(seed: string, roleOrClass?: string, race?: CharacterRace): PortraitSpec {
  const h = hashString(`${seed}:${roleOrClass ?? 'default'}:${race ?? 'npc'}`);
  const role = (roleOrClass ?? 'default').toLowerCase();
  const trait = traitForRace(race);

  return {
    skinTone: race === 'half-orc' ? '#8da36b' : race === 'tiefling' ? pick(['#b85c70', '#9f5fb5', '#8b4661'], h, 3) : pick(SKIN_TONES, h, 1),
    hairColor: pick(HAIR_COLORS, h, 5),
    eyeColor: pick(EYE_COLORS, h, 8),
    accentColor: CLASS_ACCENTS[role] ?? CLASS_ACCENTS.default,
    cloakColor: CLASS_CLOAKS[role] ?? CLASS_CLOAKS.default,
    background: pick(BACKGROUNDS, h, 11),
    hair: role === 'rogue' || role.includes('вор') ? 'hood' : pick(['cropped', 'waves', 'braids', 'wild'], h, 14),
    expression: pick(['calm', 'stern', 'bright'], h, 18),
    trait,
    faceWidth: trait === 'beard' ? 34 : trait === 'soft-ears' ? 38 : 32 + (h % 5),
    faceHeight: trait === 'soft-ears' ? 35 : 40 + ((h >> 6) % 6),
  };
}
