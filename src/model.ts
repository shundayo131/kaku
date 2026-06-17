// Which provider + model the AI features call. Persisted locally (non-secret).

export type ActiveModel = { provider: string; model: string };

const STORAGE_KEY = "writer.activeModel.v1";

export const PROVIDERS = ["anthropic", "openai", "gemini", "kimi"] as const;

export const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  gemini: "Google Gemini",
  kimi: "Kimi (Moonshot)",
};

// Sensible default model id per provider. User-editable — only Anthropic is
// wired to an adapter today, so the others are placeholders until then.
export const DEFAULT_MODEL: Record<string, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-5.1",
  gemini: "gemini-3-pro",
  kimi: "kimi-k2",
};

export function getActiveModel(): ActiveModel {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ActiveModel;
  } catch {
    /* fall through to default */
  }
  return { provider: "anthropic", model: DEFAULT_MODEL.anthropic };
}

export function setActiveModel(m: ActiveModel): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
}
