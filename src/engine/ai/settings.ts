// ============================================================================
// Groq connection settings. The API key never lives in source or the bundle —
// the player enters it in Settings and it is kept in localStorage on their own
// device (this is a static client-side app deployed to GitHub Pages).
// ============================================================================

const KEY_STORAGE = 'dm_groq_api_key';
const MODEL_STORAGE = 'dm_groq_model';

/** Default Groq model — strong instruction-following + JSON mode support. */
export const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

/** A few known-good Groq models offered in the Settings dropdown. */
export const AVAILABLE_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
] as const;

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getApiKey(): string {
  return storage()?.getItem(KEY_STORAGE)?.trim() ?? '';
}

export function setApiKey(key: string): void {
  const store = storage();
  if (!store) return;
  const trimmed = key.trim();
  if (trimmed) store.setItem(KEY_STORAGE, trimmed);
  else store.removeItem(KEY_STORAGE);
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

export function getModel(): string {
  return storage()?.getItem(MODEL_STORAGE)?.trim() || DEFAULT_MODEL;
}

export function setModel(model: string): void {
  storage()?.setItem(MODEL_STORAGE, model.trim() || DEFAULT_MODEL);
}
