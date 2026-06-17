import { useCallback, useEffect } from "react";

const AUTOSAVE_MS = 600;

/** Debounced autosave while typing, plus ⌘S to force a save. */
export function useAutosave(
  content: string,
  dirty: boolean,
  activePath: string | null,
  flush: () => Promise<void>,
  onError: (message: string) => void,
) {
  const save = useCallback(() => {
    flush().catch((e) => onError(`Could not save: ${String(e)}`));
  }, [flush, onError]);

  useEffect(() => {
    if (!dirty || !activePath) return;
    const t = setTimeout(save, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [content, dirty, activePath, save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);
}
