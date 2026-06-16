import type { CharacterClass, GameState, SaveSlot } from '../types';
import { messageHistory } from '../engine/ai/messageHistory';

const SAVE_KEY_PREFIX = 'dm_save_';

/** Number of available save slots. */
export const SAVE_SLOT_COUNT = 3;

/**
 * Current save schema version. v2 (Phase 7) introduced the AI `locations`
 * world model; v3 (Phase 8) added queued level-ups, story summary and persisted
 * AI message history. Older saves are structurally incompatible -> ignored.
 */
export const SAVE_VERSION = 3;

/** Emoji icon per class — used in save lists and character UI. */
export const CLASS_ICONS: Record<CharacterClass, string> = {
  fighter: '⚔️',
  rogue: '🗡️',
  wizard: '🪄',
  cleric: '✨',
  ranger: '🏹',
  bard: '🎵',
};

/** Approx. wall-clock start of this session, used to accrue play time. */
const sessionStart = Date.now();

/** localStorage handle, or null when unavailable (SSR / privacy mode). */
function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function slotKey(slotIndex: number): string {
  return `${SAVE_KEY_PREFIX}${slotIndex}`;
}

function isValidSlot(slotIndex: number): boolean {
  return Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < SAVE_SLOT_COUNT;
}

function minutesSince(epochMs: number): number {
  return Math.max(0, Math.round((Date.now() - epochMs) / 60_000));
}

/** Narrow unknown parsed JSON to a SaveSlot of the current version. */
function isSaveSlot(value: unknown): value is SaveSlot {
  if (typeof value !== 'object' || value === null) return false;
  const slot = value as Partial<SaveSlot>;
  return (
    typeof slot.slotIndex === 'number' &&
    slot.version === SAVE_VERSION &&
    typeof slot.characterName === 'string' &&
    typeof slot.gameState === 'object' &&
    slot.gameState !== null
  );
}

/** Persist the current game to a slot. Returns the written slot, or null on failure. */
export function saveGame(state: GameState, slotIndex: number): SaveSlot | null {
  const store = storage();
  if (!store || !isValidSlot(slotIndex) || !state.character) return null;

  const previous = loadGame(slotIndex);
  const slot: SaveSlot = {
    slotIndex,
    version: SAVE_VERSION,
    characterName: state.character.name,
    characterClass: state.character.class,
    characterLevel: state.character.level,
    floor: state.depth,
    savedAt: new Date().toISOString(),
    playtime: (previous?.playtime ?? 0) + minutesSince(sessionStart),
    gameState: state,
    aiMessageHistory: messageHistory.getHistory(),
  };

  try {
    store.setItem(slotKey(slotIndex), JSON.stringify(slot));
    return slot;
  } catch {
    // Quota exceeded or serialization failure.
    return null;
  }
}

/** Read a save slot, or null when empty / corrupt / incompatible version. */
export function loadGame(slotIndex: number): SaveSlot | null {
  const store = storage();
  if (!store || !isValidSlot(slotIndex)) return null;

  const raw = store.getItem(slotKey(slotIndex));
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isSaveSlot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function deleteSave(slotIndex: number): void {
  const store = storage();
  if (!store || !isValidSlot(slotIndex)) return;
  store.removeItem(slotKey(slotIndex));
}

/** All slots in order; empty slots are null. */
export function listSaves(): (SaveSlot | null)[] {
  return Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => loadGame(index));
}

export function hasAnySave(): boolean {
  return listSaves().some((slot) => slot !== null);
}

/** Format an ISO timestamp as dd.mm.yyyy hh:mm. */
export function formatSaveDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (value: number): string => value.toString().padStart(2, '0');
  const datePart = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${datePart} ${timePart}`;
}

/** Format minutes as "45 мин" or "2ч 15мин". */
export function formatPlaytime(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  if (total < 60) return `${total} мин`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins === 0 ? `${hours}ч` : `${hours}ч ${mins}мин`;
}
