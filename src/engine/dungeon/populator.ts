// ============================================================================
// Assigns a type to every room and fills it with enemies, loot, traps, lore
// and NPCs. Pure and seeded (derives its own RNG stream from dungeon.seed).
//
// NOTE: unused since Phase 7, kept for reference. The world is now built on the
// fly by the AI Dungeon Master (see src/engine/world + src/engine/ai).
// ============================================================================

import type { Dungeon, Room, RoomType } from '../../types';
import { chance, createRng, pick, randInt, shuffle, weightedPick } from '../random';
import type { Rng } from '../random';
import {
  createDarkMage,
  createGoblin,
  createOrc,
  createSkeleton,
  createTroll,
  createZombie,
} from './bestiary';
import { createScrollOfFireball, rollLoot } from './lootTables';
import { LORE_TEXTS } from '../narrative/templates';

// Weighted distribution for the "ordinary" rooms (everything but the fixed types).
const REST_ROOM_TYPES: { value: RoomType; weight: number }[] = [
  { value: 'corridor', weight: 30 },
  { value: 'barracks', weight: 25 },
  { value: 'library', weight: 15 },
  { value: 'crypt', weight: 15 },
  { value: 'trap', weight: 10 },
  { value: 'puzzle', weight: 5 },
];

const WEAK_ENEMIES = [createGoblin, createSkeleton];
const BARRACKS_ENEMIES = [createGoblin, createSkeleton, createOrc];
const UNDEAD_ENEMIES = [createSkeleton, createZombie];
const BOSS_ENEMIES = [createTroll, createDarkMage];

/** Breadth-first corridor distance from a starting room to every other. */
function bfsDistances(rooms: Room[], startId: string): Map<string, number> {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const dist = new Map<string, number>([[startId, 0]]);
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const room = byId.get(id);
    if (!room) continue;
    for (const neighbourId of room.connections) {
      if (!dist.has(neighbourId)) {
        dist.set(neighbourId, (dist.get(id) ?? 0) + 1);
        queue.push(neighbourId);
      }
    }
  }
  return dist;
}

/** Fill a single room with content appropriate to its assigned type. */
function populateRoom(room: Room, rng: Rng): void {
  switch (room.type) {
    case 'corridor':
      if (chance(rng, 0.5)) room.enemies = [pick(rng, WEAK_ENEMIES)()];
      break;
    case 'barracks':
      room.enemies = Array.from({ length: randInt(rng, 2, 3) }, () => pick(rng, BARRACKS_ENEMIES)());
      break;
    case 'crypt':
      room.enemies = Array.from({ length: randInt(rng, 1, 2) }, () => pick(rng, UNDEAD_ENEMIES)());
      break;
    case 'library':
      room.lore = pick(rng, LORE_TEXTS);
      if (chance(rng, 0.4)) room.items = [createScrollOfFireball()];
      break;
    case 'treasure':
      room.items = rollLoot(rng, randInt(rng, 2, 3));
      break;
    case 'trap':
      if (chance(rng, 0.5)) room.enemies = [createGoblin()];
      room.trap = {
        type: 'dart',
        dc: 12,
        detected: false,
        disarmed: false,
        triggered: false,
        damageDice: 'd6',
        damageCount: 1,
        damageType: 'piercing',
      };
      break;
    case 'shop':
      room.npcId = 'merchant';
      break;
    case 'boss':
      room.enemies = [pick(rng, BOSS_ENEMIES)()];
      break;
    case 'entrance':
    case 'puzzle':
      break;
  }
}

/** Assign room types and populate the dungeon. Mutates and returns it. */
export function populateDungeon(dungeon: Dungeon): Dungeon {
  const rng = createRng((dungeon.seed ^ 0x9e3779b9) >>> 0);
  const { rooms } = dungeon;
  if (rooms.length === 0) return dungeon;

  // 1. Entrance = the starting room.
  const entrance = rooms.find((room) => room.id === dungeon.currentRoomId) ?? rooms[0];
  entrance.type = 'entrance';

  // 2. Boss = the room farthest from the entrance by corridor distance.
  const distances = bfsDistances(rooms, entrance.id);
  let boss = entrance;
  let maxDistance = -1;
  for (const room of rooms) {
    const distance = distances.get(room.id) ?? 0;
    if (room.id !== entrance.id && distance > maxDistance) {
      maxDistance = distance;
      boss = room;
    }
  }
  if (boss !== entrance) boss.type = 'boss';

  // 3-4. One shop + one treasure; the rest weighted-random.
  const rest = shuffle(rng, rooms.filter((room) => room !== entrance && room !== boss));
  let cursor = 0;
  if (rest[cursor]) rest[cursor++].type = 'shop';
  if (rest[cursor]) rest[cursor++].type = 'treasure';
  for (; cursor < rest.length; cursor += 1) {
    rest[cursor].type = weightedPick(rng, REST_ROOM_TYPES);
  }

  for (const room of rooms) populateRoom(room, rng);

  // Reveal the starting area so the map isn't blank on entry.
  entrance.isVisited = true;
  entrance.isRevealed = true;
  for (const neighbourId of entrance.connections) {
    const neighbour = rooms.find((room) => room.id === neighbourId);
    if (neighbour) neighbour.isRevealed = true;
  }

  return dungeon;
}
