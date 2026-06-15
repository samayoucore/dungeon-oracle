import type { LocationType } from '../../types';

/** Emoji per location type (atlas + exit list). */
export const LOCATION_ICON: Record<LocationType, string> = {
  dungeon_room: '🏛',
  corridor: '➡',
  cave: '🕳',
  crypt: '⚰',
  library: '📖',
  shrine: '✨',
  town: '🏘',
  building_interior: '🏠',
  wilderness: '🌲',
  boss_lair: '💀',
  other: '❔',
};

/** Player-facing Russian label per location type. */
export const LOCATION_LABEL: Record<LocationType, string> = {
  dungeon_room: 'Зал подземелья',
  corridor: 'Коридор',
  cave: 'Пещера',
  crypt: 'Крипта',
  library: 'Библиотека',
  shrine: 'Святилище',
  town: 'Город',
  building_interior: 'Помещение',
  wilderness: 'Дикие земли',
  boss_lair: 'Логово',
  other: 'Место',
};
