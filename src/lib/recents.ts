import type { Doc } from "../types";

export const RECENTS_MAX = 30;

/** Add a doc to the front, de-duplicated by path, capped at RECENTS_MAX. */
export function addRecent(list: Doc[], doc: Doc): Doc[] {
  return [doc, ...list.filter((d) => d.path !== doc.path)].slice(0, RECENTS_MAX);
}

export function removeRecent(list: Doc[], path: string): Doc[] {
  return list.filter((d) => d.path !== path);
}
