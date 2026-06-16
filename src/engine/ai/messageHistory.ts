// ============================================================================
// Conversational memory for the DM. An in-memory ring buffer of the recent
// chat turns sent alongside the (stateful) system prompt. The authoritative
// world memory lives in the game state / worldFlags; this gives the model
// short-term conversational continuity and IS persisted with saves (Phase 8).
// ============================================================================

import type { ChatMessage } from '../../types';
import type { DMResponse } from './groqService';

export type { ChatMessage } from '../../types';

/** Keep only the last N turns so the prompt stays small and cheap. */
const MAX_MESSAGES = 16;

let history: ChatMessage[] = [];

export const messageHistory = {
  addUserAction(action: string): void {
    history.push({ role: 'user', content: action });
    trim();
  },

  /** Store the model's prose so it stays consistent with what it just said. */
  addDMResponse(response: DMResponse): void {
    const content = response.narrative?.trim();
    if (content) history.push({ role: 'assistant', content });
    trim();
  },

  getHistory(): ChatMessage[] {
    return history.slice();
  },

  /** Restore history from a loaded save (Phase 8). */
  loadHistory(loaded: ChatMessage[]): void {
    history = Array.isArray(loaded) ? loaded.slice(-MAX_MESSAGES) : [];
  },

  clear(): void {
    history = [];
  },
};

function trim(): void {
  if (history.length > MAX_MESSAGES) {
    history = history.slice(history.length - MAX_MESSAGES);
  }
}
