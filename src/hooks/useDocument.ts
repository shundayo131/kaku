import { useCallback, useRef, useState } from "react";
import { readDoc, writeDoc } from "../lib/tauri/fs";
import { splitFrontmatter, joinFrontmatter } from "../lib/frontmatter";
import { useLatest } from "./useLatest";

/** The active document buffer: content, dirty/saving state, load + save.
 * YAML frontmatter is sliced off on load and reattached on save — the editor
 * never sees it. Operations throw on IO failure; callers surface errors. */
export function useDocument() {
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContentState] = useState(""); // body only (no frontmatter)
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Frontmatter doesn't affect rendering, so keep it in a ref.
  const frontmatterRef = useRef<string | null>(null);

  // Read latest values inside flush without stale closures.
  const live = useLatest({ activePath, content, dirty });

  const flush = useCallback(async () => {
    const { activePath: p, content: c, dirty: d } = live.current;
    if (!p || !d) return;
    setSaving(true);
    try {
      await writeDoc(p, joinFrontmatter(frontmatterRef.current, c));
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [live]);

  /** Set the active document directly: body text + optional frontmatter. */
  const adopt = useCallback(
    (path: string, body: string, frontmatter: string | null = null) => {
      frontmatterRef.current = frontmatter;
      setActivePath(path);
      setContentState(body);
      setDirty(false);
    },
    [],
  );

  /** Flush the current doc, then read another, splitting off its frontmatter. */
  const load = useCallback(
    async (path: string) => {
      await flush();
      const raw = await readDoc(path);
      const { frontmatter, body } = splitFrontmatter(raw);
      adopt(path, body, frontmatter);
    },
    [flush, adopt],
  );

  const setContent = useCallback((next: string) => {
    setContentState(next);
    setDirty(true);
  }, []);

  return { activePath, content, dirty, saving, flush, load, adopt, setContent };
}
