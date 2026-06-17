import { describe, it, expect, beforeEach } from "vitest";
import { getActiveModel, setActiveModel, DEFAULT_MODEL } from "./model";

beforeEach(() => localStorage.clear());

describe("model", () => {
  it("defaults to Anthropic with its default model", () => {
    expect(getActiveModel()).toEqual({
      provider: "anthropic",
      model: DEFAULT_MODEL.anthropic,
    });
  });

  it("round-trips the selected model", () => {
    setActiveModel({ provider: "openai", model: "gpt-x" });
    expect(getActiveModel()).toEqual({ provider: "openai", model: "gpt-x" });
  });
});
