// ============================================================================
// World bootstrap (Phase 7). Builds the single starting location a new game
// begins in. From here the DM grows the world on the fly. Pure, no React.
// ============================================================================

import type { Location } from '../../types';

const STARTING_DESCRIPTIONS = [
  'Тяжёлая дверь за спиной захлопывается с гулким стуком. Сырой холод обступает тебя, факелы вдоль стен мерцают тревожным светом.',
  'Ты спускаешься по истёртым каменным ступеням. Воздух пахнет землёй и старостью. Впереди — темнота подземелья.',
  'Путь назад отрезан. Вокруг — древние камни, покрытые мхом и забытыми символами. Здесь начинается твой путь.',
  'Свод над головой теряется во мраке. Где-то вдалеке капает вода, и эхо разносит каждый твой шаг по мёртвым залам.',
  'Холодный сквозняк тянет из глубины, неся запах праха и железа. Подземелье ждёт, затаив дыхание.',
];

/** A fresh, enemy-less entrance the DM expands from. */
export function createStartingLocation(): Location {
  const description = STARTING_DESCRIPTIONS[Math.floor(Math.random() * STARTING_DESCRIPTIONS.length)];
  return {
    id: crypto.randomUUID(),
    name: 'Вход в подземелье',
    type: 'dungeon_room',
    description,
    biome: 'crypt',
    dangerLevel: 1,
    enemiesPresent: [],
    itemsPresent: [],
    npcIds: [],
    connections: [],
    isSafeZone: false,
    visitCount: 1,
    discoveredAt: 0,
  };
}
