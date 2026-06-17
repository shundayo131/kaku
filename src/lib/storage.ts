// Versioned, fault-tolerant localStorage helpers. Bump the version suffix when a
// shape changes so stale data is ignored rather than mis-parsed.

export const STORAGE_KEYS = {
  recents: "writer.recents.v1",
  activeModel: "writer.activeModel.v1",
} as const;

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}
