// ============================================================================
// Procedural dungeon generation via Binary Space Partitioning (BSP).
// Pure, seeded, React-free. Produces rooms + corridor connections; the
// populator (populator.ts) later assigns room types and contents.
//
// NOTE: unused since Phase 7, kept for reference. The world is now built on the
// fly by the AI Dungeon Master (see src/engine/world + src/engine/ai).
// ============================================================================

import type { Biome, Dungeon, Rect, Room } from '../../types';
import { createRng, randInt, randomSeed } from '../random';
import type { Rng } from '../random';

const MAP_WIDTH = 80;
const MAP_HEIGHT = 60;
const MIN_LEAF_W = 10;
const MIN_LEAF_H = 8;
const MIN_ROOM_W = 5;
const MIN_ROOM_H = 4;
const TARGET_ROOMS_MIN = 12;
const TARGET_ROOMS_MAX = 18;
const SPLIT_MIN = 0.4;
const SPLIT_MAX = 0.6;
const SPLIT_GUARD = 500;

interface BSPNode {
  rect: Rect;
  left?: BSPNode;
  right?: BSPNode;
  room?: Room;
}

function area(rect: Rect): number {
  return rect.w * rect.h;
}

function isSplittable(node: BSPNode): boolean {
  return node.rect.w >= MIN_LEAF_W * 2 || node.rect.h >= MIN_LEAF_H * 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Split a leaf into two children. Returns false if it cannot be split. */
function splitNode(node: BSPNode, rng: Rng): boolean {
  const { rect } = node;
  const canVertical = rect.w >= MIN_LEAF_W * 2;
  const canHorizontal = rect.h >= MIN_LEAF_H * 2;
  if (!canVertical && !canHorizontal) return false;

  let vertical: boolean;
  if (canVertical && canHorizontal) {
    if (rect.w / rect.h >= 1.25) vertical = true;
    else if (rect.h / rect.w >= 1.25) vertical = false;
    else vertical = rng() < 0.5;
  } else {
    vertical = canVertical;
  }

  if (vertical) {
    const raw = randInt(rng, Math.round(rect.w * SPLIT_MIN), Math.round(rect.w * SPLIT_MAX));
    const splitW = clamp(raw, MIN_LEAF_W, rect.w - MIN_LEAF_W);
    node.left = { rect: { x: rect.x, y: rect.y, w: splitW, h: rect.h } };
    node.right = { rect: { x: rect.x + splitW, y: rect.y, w: rect.w - splitW, h: rect.h } };
  } else {
    const raw = randInt(rng, Math.round(rect.h * SPLIT_MIN), Math.round(rect.h * SPLIT_MAX));
    const splitH = clamp(raw, MIN_LEAF_H, rect.h - MIN_LEAF_H);
    node.left = { rect: { x: rect.x, y: rect.y, w: rect.w, h: splitH } };
    node.right = { rect: { x: rect.x, y: rect.y + splitH, w: rect.w, h: rect.h - splitH } };
  }
  return true;
}

/** Build the BSP tree, splitting the largest leaves until we hit the target. */
function buildTree(rng: Rng, target: number): { root: BSPNode; leaves: BSPNode[] } {
  const root: BSPNode = { rect: { x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT } };
  const leaves: BSPNode[] = [root];

  let guard = 0;
  while (leaves.length < target && guard < SPLIT_GUARD) {
    guard += 1;
    const splittable = leaves.filter(isSplittable);
    if (splittable.length === 0) break;
    splittable.sort((a, b) => area(b.rect) - area(a.rect));
    // Pick among the largest few for size variety.
    const node = splittable[randInt(rng, 0, Math.min(2, splittable.length - 1))];
    if (splitNode(node, rng) && node.left && node.right) {
      leaves.splice(leaves.indexOf(node), 1, node.left, node.right);
    }
  }
  return { root, leaves };
}

/** Carve a room inside a leaf node, inset 1-2 tiles from each edge. */
function createRoom(node: BSPNode, rng: Rng, index: number): Room {
  const { rect } = node;
  const insetL = randInt(rng, 1, 2);
  const insetT = randInt(rng, 1, 2);
  const availW = Math.max(MIN_ROOM_W, rect.w - insetL - randInt(rng, 1, 2));
  const availH = Math.max(MIN_ROOM_H, rect.h - insetT - randInt(rng, 1, 2));
  const w = randInt(rng, MIN_ROOM_W, availW);
  const h = randInt(rng, MIN_ROOM_H, availH);
  const x = rect.x + insetL + randInt(rng, 0, Math.max(0, availW - w));
  const y = rect.y + insetT + randInt(rng, 0, Math.max(0, availH - h));
  return {
    id: `room-${index}`,
    type: 'corridor',
    rect: { x, y, w, h },
    connections: [],
    enemies: [],
    items: [],
    isVisited: false,
    isRevealed: false,
    isCleared: false,
  };
}

function connect(a: Room, b: Room): void {
  if (!a.connections.includes(b.id)) a.connections.push(b.id);
  if (!b.connections.includes(a.id)) b.connections.push(a.id);
}

/** Recursively connect both subtrees at every internal node (spanning tree). */
function connectTree(node: BSPNode, rng: Rng): Room {
  if (node.room) return node.room;
  const a = connectTree(node.left as BSPNode, rng);
  const b = connectTree(node.right as BSPNode, rng);
  connect(a, b);
  return rng() < 0.5 ? a : b;
}

/** Generate a fully-connected dungeon floor. Types/contents added by populator. */
export function generateDungeon(floor: number, biome: Biome): Dungeon {
  const seed = randomSeed();
  const rng = createRng(seed);
  const target = randInt(rng, TARGET_ROOMS_MIN, TARGET_ROOMS_MAX);

  const { root, leaves } = buildTree(rng, target);
  const rooms = leaves.map((leaf, index) => {
    const room = createRoom(leaf, rng, index);
    leaf.room = room;
    return room;
  });
  connectTree(root, rng);

  return {
    rooms,
    currentRoomId: rooms[0].id,
    floor,
    biome,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    seed,
  };
}
