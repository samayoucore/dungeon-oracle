// ============================================================================
// Global achievement persistence (Phase 12). Trophies live in localStorage,
// separate from save slots — they survive death and new games.
// ============================================================================

const ACHIEVEMENTS_KEY = 'dm_achievements';

export function loadUnlockedAchievements(): string[] {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Persist a newly-unlocked id. Returns false if it was already unlocked. */
export function persistUnlock(id: string): boolean {
  const current = loadUnlockedAchievements();
  if (current.includes(id)) return false;
  current.push(id);
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(current));
  } catch {
    /* ignore storage failures */
  }
  return true;
}
