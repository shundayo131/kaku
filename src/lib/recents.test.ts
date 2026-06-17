import { describe, it, expect } from "vitest";
import { addRecent, removeRecent, RECENTS_MAX } from "./recents";
import type { Doc } from "../types";

const doc = (p: string): Doc => ({ name: `${p}.md`, path: p });

describe("recents", () => {
  it("adds a doc to the front", () => {
    expect(addRecent([doc("a")], doc("b")).map((d) => d.path)).toEqual([
      "b",
      "a",
    ]);
  });

  it("de-dupes by path and moves the existing entry to the front", () => {
    const r = addRecent([doc("a"), doc("b")], doc("b"));
    expect(r.map((d) => d.path)).toEqual(["b", "a"]);
    expect(r.length).toBe(2);
  });

  it("caps the list at RECENTS_MAX, newest first", () => {
    let list: Doc[] = [];
    for (let i = 0; i < RECENTS_MAX + 5; i++) list = addRecent(list, doc(`p${i}`));
    expect(list.length).toBe(RECENTS_MAX);
    expect(list[0].path).toBe(`p${RECENTS_MAX + 4}`);
  });

  it("removes by path", () => {
    expect(removeRecent([doc("a"), doc("b")], "a").map((d) => d.path)).toEqual([
      "b",
    ]);
  });
});
