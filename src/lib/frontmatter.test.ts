import { describe, it, expect } from "vitest";
import { splitFrontmatter, joinFrontmatter } from "./frontmatter";

describe("frontmatter", () => {
  it("splits a leading YAML block from the body", () => {
    const md = "---\ntitle: X\ntags: [a, b]\n---\n# Heading\nbody";
    const { frontmatter, body } = splitFrontmatter(md);
    expect(frontmatter).toBe("---\ntitle: X\ntags: [a, b]\n---\n");
    expect(body).toBe("# Heading\nbody");
  });

  it("returns null frontmatter when absent", () => {
    const md = "# Heading\nbody";
    expect(splitFrontmatter(md)).toEqual({ frontmatter: null, body: md });
  });

  it("does not treat a mid-document --- as frontmatter", () => {
    const md = "intro\n\n---\n\nmore";
    expect(splitFrontmatter(md).frontmatter).toBe(null);
  });

  it("captures only the first closing fence (later --- stays in body)", () => {
    const md = "---\ntitle: X\n---\nbody\n\n---\n\nmore";
    const { frontmatter, body } = splitFrontmatter(md);
    expect(frontmatter).toBe("---\ntitle: X\n---\n");
    expect(body).toBe("body\n\n---\n\nmore");
  });

  it("ignores a --- inside a YAML value", () => {
    const md = "---\ntitle: a---b\n---\nbody";
    const { frontmatter, body } = splitFrontmatter(md);
    expect(frontmatter).toBe("---\ntitle: a---b\n---\n");
    expect(body).toBe("body");
  });

  it("round-trips byte-for-byte", () => {
    const md = "---\ntitle: X\n---\nbody text";
    const { frontmatter, body } = splitFrontmatter(md);
    expect(joinFrontmatter(frontmatter, body)).toBe(md);
  });

  it("join with null frontmatter returns the body unchanged", () => {
    expect(joinFrontmatter(null, "body")).toBe("body");
  });
});
