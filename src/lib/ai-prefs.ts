// AI behavior preferences. Persisted locally (non-secret).
//
// Thinking is on by default (better reasoning, no external calls). Web search is
// OFF by default: it sends the query off-device to Anthropic's search service,
// which conflicts with the app's local-first default — so it's strictly opt-in.

import { STORAGE_KEYS, readJSON, writeJSON } from "./storage";

export type AiPrefs = {
  thinking: boolean;
  webSearch: boolean;
};

export const DEFAULT_AI_PREFS: AiPrefs = {
  thinking: true,
  webSearch: false,
};

export function getAiPrefs(): AiPrefs {
  // Merge over defaults so a stored partial (or future-added field) is safe.
  return { ...DEFAULT_AI_PREFS, ...readJSON<Partial<AiPrefs>>(STORAGE_KEYS.aiPrefs, {}) };
}

export function setAiPrefs(prefs: AiPrefs): void {
  writeJSON(STORAGE_KEYS.aiPrefs, prefs);
}
