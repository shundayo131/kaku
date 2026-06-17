import { useCallback, useState } from "react";
import { readDoc, writeDoc } from "../lib/tauri/fs";
import { useLatest } from "./useLatest";

/** The active document buffer: content, dirty/saving state, load + save.
 * Operations throw on IO failure — callers decide how to surface errors. */
export function useDocument() {
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContentState] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Read latest values inside flush without stale closures.
  const live = useLatest({ activePath, content, dirty });

  const flush = useCallback(async () => {
    const { activePath: p, content: c, dirty: d } = live.current;
    if (!p || !d) return;
    setSaving(true);
    try {
      await writeDoc(p, c);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [live]);

  /** Set the active document directly (used by load + new). */
  const adopt = useCallback((path: string, text: string) => {
    setActivePath(path);
    setContentState(text);
    setDirty(false);
  }, []);

  /** Flush the current doc, then read and adopt another. */
  const load = useCallback(
    async (path: string) => {
      await flush();
      const text = await readDoc(path);
      adopt(path, text);
    },
    [flush, adopt],
  );

  const setContent = useCallback((next: string) => {
    setContentState(next);
    setDirty(true);
  }, []);

  return { activePath, content, dirty, saving, flush, load, adopt, setContent };
}
