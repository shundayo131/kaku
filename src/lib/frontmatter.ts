// YAML frontmatter passthrough. The editor must never parse the leading
// `---\n…\n---` block (Tiptap would mangle it), so we slice it off byte-for-byte
// before editing and reattach it verbatim on save.

// Opening `---` line, optional content lines, closing `---` line. The capture is
// the entire block (fences + trailing newline) so join is plain concatenation.
const FM_RE =
  /^(---[ \t]*\r?\n(?:[\s\S]*?\r?\n)?---[ \t]*(?:\r?\n|$))([\s\S]*)$/;

export type Split = { frontmatter: string | null; body: string };

export function splitFrontmatter(markdown: string): Split {
  const m = markdown.match(FM_RE);
  if (!m) return { frontmatter: null, body: markdown };
  return { frontmatter: m[1], body: m[2] };
}

export function joinFrontmatter(
  frontmatter: string | null,
  body: string,
): string {
  return frontmatter ? frontmatter + body : body;
}
