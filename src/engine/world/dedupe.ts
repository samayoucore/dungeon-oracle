// ============================================================================
// Fuzzy de-duplication of AI-named entities (Phase 8). The DM re-invents names
// and ids freely ("Борис" -> "Борис-кузнец"), which would otherwise spawn a
// duplicate NPC/location instead of referencing the same one. Matching is
// deliberately conservative — short names never fuzzy-match.
// ============================================================================

import type { Location, NPC } from '../../types';

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\wа-яё\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when two display names almost certainly refer to the same entity. */
export function namesSimilar(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Substring match only for names long enough that it isn't coincidental.
  if (na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  return false;
}

export function findExistingNpcByName(npcs: Record<string, NPC>, name: string): NPC | null {
  return Object.values(npcs).find((n) => namesSimilar(n.name, name)) ?? null;
}

export function findExistingLocationByName(
  locations: Record<string, Location>,
  name: string,
): Location | null {
  return Object.values(locations).find((l) => namesSimilar(l.name, name)) ?? null;
}
