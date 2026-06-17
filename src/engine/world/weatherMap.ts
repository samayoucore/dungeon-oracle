// ============================================================================
// Atmospheric/weather effect per location (Phase 12). Pure mapping; biome
// keywords override the location-type default. No React, no store.
// ============================================================================

import type { Location, LocationType } from '../../types';

export type WeatherEffect = 'rain' | 'fog' | 'embers' | 'snow' | 'dust' | 'none';

const TYPE_DEFAULTS: Record<LocationType, WeatherEffect> = {
  dungeon_room: 'dust',
  corridor: 'dust',
  cave: 'fog',
  crypt: 'fog',
  library: 'dust',
  shrine: 'embers',
  town: 'none',
  building_interior: 'none',
  wilderness: 'rain',
  boss_lair: 'embers',
  other: 'none',
};

export function getWeatherForLocation(loc: Location): WeatherEffect {
  const biome = loc.biome.toLowerCase();
  if (/снег|снеж|мороз|лёд|лед|ice|snow|frost/.test(biome)) return 'snow';
  if (/лес|forest|болот|swamp|дожд|rain/.test(biome)) return 'rain';
  if (/пустын|desert|песок|sand/.test(biome)) return 'dust';
  return TYPE_DEFAULTS[loc.type] ?? 'none';
}
