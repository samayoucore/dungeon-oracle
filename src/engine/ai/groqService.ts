// ============================================================================
// Groq chat client + the DMResponse contract (Phase 7).
//
// The DM model is the storyteller: it returns prose plus structured fields the
// game applies to state. It NEVER decides combat outcomes — only WHEN combat
// starts and WITH WHOM. All numeric content is clamped via world/validation.
// ============================================================================

import type {
  LocationType,
  Stats,
  StatusEffect,
  WorldFlags,
} from '../../types';
import type { RawEnemy, RawItem } from '../world/validation';
import type { ChatMessage } from './messageHistory';
import type { GameContext } from './prompts';
import { buildRollOutcomeMessage, buildSystemPrompt, buildUserMessage } from './prompts';
import { getApiKey, getModel } from './settings';

// ---------------------------------------------------------------------------
// Response contract
// ---------------------------------------------------------------------------

export interface DMResponse {
  // --- Text (always) ---
  narrative: string;
  narrationOnly?: boolean;

  // --- Combat (signal only — the engine resolves the fight) ---
  combatStart?: { ambushEnemies?: RawEnemy[] } | null;

  // --- Items & resources ---
  itemFound?: RawItem | null;
  itemsConsumed?: string[] | null;
  goldChange?: number | null;
  xpGained?: number | null;

  // --- Out-of-combat character state ---
  hpChange?: number | null;
  statusEffects?: { add?: StatusEffect[]; remove?: StatusEffect[] } | null;
  statChanges?: { stat: keyof Stats; delta: number; reason: string }[] | null;

  // --- Skill checks ---
  requiresRoll?: { stat: keyof Stats; dc: number; description: string } | null;

  // --- Quests ---
  newQuest?: {
    title: string;
    description: string;
    objectives: { description: string; targetCount?: number }[];
    rewards: { xp: number; gold: number };
  } | null;
  questUpdate?: { questId: string; objectiveId: string } | null;

  // --- World & memory ---
  worldFlags?: WorldFlags | null;
  npcIntroduced?: {
    id: string;
    name: string;
    role: string;
    description: string;
    icon: string;
    shopInventory?: RawItem[];
  } | null;
  locationLore?: string | null;

  // --- Current-location enemies ---
  clearLocationEnemies?: boolean | null;

  // --- Navigation ---
  newLocation?: {
    name: string;
    type: LocationType;
    description: string;
    biome: string;
    connectionLabel: string;
    isSafeZone?: boolean;
    enemies?: RawEnemy[];
    items?: RawItem[];
    depthDelta?: number;
  } | null;
  moveToLocation?: { locationId: string; connectionLabel?: string } | null;
  currentLocationUpdate?: { name?: string; description?: string; type?: LocationType } | null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type GroqErrorCode = 'no-key' | 'http' | 'network' | 'parse';

export class GroqError extends Error {
  code: GroqErrorCode;
  constructor(code: GroqErrorCode, message: string) {
    super(message);
    this.name = 'GroqError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqChoice {
  message?: { content?: string };
}
interface GroqCompletion {
  choices?: GroqChoice[];
}

async function request(messages: { role: string; content: string }[]): Promise<DMResponse> {
  const apiKey = getApiKey();
  if (!apiKey) throw new GroqError('no-key', 'Groq API key is not set.');

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getModel(),
        temperature: 0.85,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages,
      }),
    });
  } catch (err) {
    throw new GroqError('network', `Network error contacting Groq: ${String(err)}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GroqError('http', `Groq HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as GroqCompletion;
  const content = data.choices?.[0]?.message?.content ?? '';
  return parseResponse(content);
}

/** Tolerantly parse the model's JSON; degrade to plain narration on failure. */
function parseResponse(content: string): DMResponse {
  const fallback: DMResponse = {
    narrative: 'Мастер Подземелий на миг теряет нить повествования…',
    narrationOnly: true,
  };
  if (!content.trim()) return fallback;

  const cleaned = content.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const candidates = [cleaned];
  const braceMatch = cleaned.match(/\{[\s\S]*\}/);
  if (braceMatch) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as DMResponse;
      if (typeof parsed.narrative !== 'string' || !parsed.narrative.trim()) {
        parsed.narrative = fallback.narrative;
      }
      return parsed;
    } catch {
      // try the next candidate
    }
  }
  console.warn('[groqService] Could not parse DM response as JSON:', content.slice(0, 400));
  return fallback;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const groqService = {
  /** Resolve a free-form player action into a DMResponse. */
  async sendMessage(action: string, ctx: GameContext, history: ChatMessage[]): Promise<DMResponse> {
    const messages = [
      { role: 'system', content: buildSystemPrompt(ctx) },
      ...history,
      { role: 'user', content: buildUserMessage(action) },
    ];
    return request(messages);
  },

  /** Continue the story after a skill-check roll has been resolved by the engine. */
  async sendRollOutcome(
    description: string,
    stat: keyof Stats,
    dc: number,
    total: number,
    success: boolean,
    ctx: GameContext,
    history: ChatMessage[],
  ): Promise<DMResponse> {
    const messages = [
      { role: 'system', content: buildSystemPrompt(ctx) },
      ...history,
      { role: 'user', content: buildRollOutcomeMessage(description, stat, dc, total, success) },
    ];
    const response = await request(messages);
    // A roll outcome must not re-open another check for the same action.
    if (response.requiresRoll) {
      console.warn('[groqService] Ignoring requiresRoll returned from a roll outcome.');
      response.requiresRoll = null;
    }
    return response;
  },

  /**
   * Background story compression (Phase 8). Plain text, no JSON schema. Must
   * never throw or surface errors — it's fire-and-forget; returns null on any
   * failure (no key, network, bad response).
   */
  async summarizeStory(prompt: string): Promise<string | null> {
    const apiKey = getApiKey();
    if (!apiKey) return null;
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: getModel(),
          max_tokens: 220,
          temperature: 0.5,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as GroqCompletion;
      return data.choices?.[0]?.message?.content?.trim() ?? null;
    } catch {
      return null;
    }
  },
};
