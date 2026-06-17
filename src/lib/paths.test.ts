import { describe, it, expect } from "vitest";
import { titleOf, nameOf, dirOf, ensureMd } from "./paths";

describe("paths", () => {
  it("titleOf strips a trailing .md, case-insensitively", () => {
    expect(titleOf("Notes.md")).toBe("Notes");
    expect(titleOf("Notes.MD")).toBe("Notes");
    expect(titleOf("no-extension")).toBe("no-extension");
    expect(titleOf("a.md.md")).toBe("a.md");
  });

  it("nameOf returns the file name", () => {
    expect(nameOf("/Users/x/Writing/Notes.md")).toBe("Notes.md");
    expect(nameOf("Notes.md")).toBe("Notes.md");
  });

  it("dirOf returns the parent directory", () => {
    expect(dirOf("/Users/x/Writing/Notes.md")).toBe("/Users/x/Writing");
  });

  it("ensureMd appends .md only when missing", () => {
    expect(ensureMd("Draft")).toBe("Draft.md");
    expect(ensureMd("Draft.md")).toBe("Draft.md");
    expect(ensureMd("Draft.MD")).toBe("Draft.MD");
  });
});
