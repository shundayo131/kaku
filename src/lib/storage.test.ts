import { describe, it, expect, beforeEach } from "vitest";
import { readJSON, writeJSON } from "./storage";

beforeEach(() => localStorage.clear());

describe("storage", () => {
  it("returns the fallback when the key is missing", () => {
    expect(readJSON("missing", [])).toEqual([]);
    expect(readJSON("missing", { a: 1 })).toEqual({ a: 1 });
  });

  it("round-trips JSON values", () => {
    writeJSON("k", { a: 1, b: [2, 3] });
    expect(readJSON("k", null)).toEqual({ a: 1, b: [2, 3] });
  });

  it("returns the fallback on malformed JSON instead of throwing", () => {
    localStorage.setItem("bad", "{not json");
    expect(readJSON("bad", "fallback")).toBe("fallback");
  });
});
