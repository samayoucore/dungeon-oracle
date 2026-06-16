// ============================================================================
// Conversational memory for the DM. An in-memory ring buffer of the recent
// chat turns sent alongside the (stateful) system prompt. The authoritative
// world memory lives in the game state / worldFlags; this gives the model
// short-term conversational continuity and IS persisted with saves (Phase 8).
// ============================================================================

import type { ChatMessage } from '../../types';
import type { DMResponse } from './groqService';

export type { ChatMessage } from '../../types';

/** Keep only the last N messages (~4 user/assistant pairs). The DMResponse
 *  schema grew in Phases 7-8, so fewer pairs now carry the same token weight. */
const MAX_MESSAGES = 8;

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
