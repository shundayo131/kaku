import { useCallback, useState } from "react";
import type { Doc } from "../types";
import { STORAGE_KEYS, readJSON, writeJSON } from "../lib/storage";
import { addRecent, removeRecent } from "../lib/recents";

/** The recent-documents list, persisted to localStorage. */
export function useRecents() {
  const [recents, setRecents] = useState<Doc[]>(() =>
    readJSON<Doc[]>(STORAGE_KEYS.recents, []),
  );

  const remember = useCallback((doc: Doc) => {
    setRecents((prev) => {
      const next = addRecent(prev, doc);
      writeJSON(STORAGE_KEYS.recents, next);
      return next;
    });
  }, []);

  const forget = useCallback((path: string) => {
    setRecents((prev) => {
      const next = removeRecent(prev, path);
      writeJSON(STORAGE_KEYS.recents, next);
      return next;
    });
  }, []);

  return { recents, remember, forget };
}
