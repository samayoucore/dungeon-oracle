import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { saveGame } from '../utils/save';
import { getDifficulty } from '../engine/world/validation';

const AUTOSAVE_SLOT = 0;

/**
 * Autosave to slot 0 every `interval` turns. Uses a ref counter so saving is
 * driven by turn count, never by incidental re-renders. Disabled on Hardcore.
 */
export function useAutosave(interval = 3, onSaved?: (ok: boolean) => void): void {
  const turns = useGameStore((s) => s.gameStats.turnsPlayed);
  const lastSavedTurn = useRef(0);

  useEffect(() => {
    if (getDifficulty() === 'hardcore') return; // Hardcore: no safety net.
    if (turns > 0 && turns - lastSavedTurn.current >= interval) {
      lastSavedTurn.current = turns;
      const slot = saveGame(useGameStore.getState(), AUTOSAVE_SLOT);
      if (slot) useGameStore.getState().markAutosaved();
      onSaved?.(slot !== null);
    }
  }, [turns, interval, onSaved]);
}
