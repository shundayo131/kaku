import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type ActiveModel,
  PROVIDERS,
  PROVIDER_LABELS,
  DEFAULT_MODEL,
  getActiveModel,
  setActiveModel,
} from "./model";

type KeyInfo = {
  id: string;
  label: string;
  present: boolean;
  masked: string;
};

const DISCLOSURE =
  "This app uses your own API key to call LLM providers directly from your " +
  "device. Your API key is stored locally in macOS Keychain and is never sent " +
  "to our servers. API usage may incur costs from your selected provider.";

export function Settings({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveModel>(getActiveModel);

  const updateActive = useCallback((next: ActiveModel) => {
    setActive(next);
    setActiveModel(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setKeys(await invoke<KeyInfo[]>("list_keys"));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (id: string) => {
      const key = drafts[id]?.trim();
      if (!key) return;
      try {
        await invoke("set_key", { provider: id, key });
        setDrafts((d) => ({ ...d, [id]: "" }));
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [drafts, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await invoke("delete_key", { provider: id });
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <strong>Settings</strong>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="settings-body">
          <p className="disclosure">{DISCLOSURE}</p>

          {error && <div className="error-banner inline">{error}</div>}

          <div className="keys-section-label">Active model</div>
          <div className="active-model">
            <select
              value={active.provider}
              onChange={(e) => {
                const provider = e.target.value;
                updateActive({ provider, model: DEFAULT_MODEL[provider] ?? "" });
              }}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
            <input
              value={active.model}
              placeholder="model id"
              onChange={(e) =>
                updateActive({ ...active, model: e.target.value })
              }
            />
          </div>

          <div className="keys-section-label">API keys</div>
          <div className="keys">
            {keys.map((k) => (
              <div className="key-field" key={k.id}>
                <div className="key-top">
                  <label>{k.label}</label>
                  {k.present && (
                    <span className="key-status">Saved · {k.masked}</span>
                  )}
                </div>
                <div className="key-row">
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={k.present ? "Replace key…" : "Paste API key"}
                    value={drafts[k.id] ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [k.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void save(k.id);
                    }}
                  />
                  <button
                    className="btn"
                    onClick={() => void save(k.id)}
                    disabled={!drafts[k.id]?.trim()}
                  >
                    Save
                  </button>
                  {k.present && (
                    <button className="btn ghost" onClick={() => void remove(k.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
