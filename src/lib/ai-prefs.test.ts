import { describe, it, expect, beforeEach } from "vitest";
import { getAiPrefs, setAiPrefs, DEFAULT_AI_PREFS } from "./ai-prefs";

beforeEach(() => localStorage.clear());

describe("ai-prefs", () => {
  it("defaults to thinking on, web search off", () => {
    expect(getAiPrefs()).toEqual(DEFAULT_AI_PREFS);
    expect(DEFAULT_AI_PREFS).toEqual({ thinking: true, webSearch: false });
  });

  it("round-trips saved prefs", () => {
    setAiPrefs({ thinking: false, webSearch: true });
    expect(getAiPrefs()).toEqual({ thinking: false, webSearch: true });
  });

  it("merges a stored partial over defaults", () => {
    localStorage.setItem("writer.aiPrefs.v1", JSON.stringify({ webSearch: true }));
    expect(getAiPrefs()).toEqual({ thinking: true, webSearch: true });
  });
});
