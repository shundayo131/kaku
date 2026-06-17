import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import { roundTrip, getMarkdown } from "./markdown";
import { editorExtensions, BLANK_MARK } from "./editor-extensions";

// Markdown must survive parse -> serialize losslessly (the core editor contract).
describe("markdown round-trip", () => {
  const cases: Record<string, string> = {
    heading: "# Title",
    "nested headings": "## Section\n\nBody text.",
    bold: "Some **bold** text.",
    italic: "Some *italic* text.",
    strikethrough: "Some ~~struck~~ text.",
    "inline code": "Use `code` inline.",
    "bullet list": "- one\n- two\n- three",
    "ordered list": "1. one\n2. two\n3. three",
    blockquote: "> a quote",
    "code block": "```js\nconst x = 1;\n```",
    paragraphs: "First paragraph.\n\nSecond paragraph.",
  };

  for (const [name, md] of Object.entries(cases)) {
    it(`preserves ${name}`, () => {
      expect(roundTrip(md).trim()).toBe(md.trim());
    });
  }
});

describe("blank-line preservation", () => {
  function docMarkdown(blocks: object[]): string {
    const editor = new Editor({ extensions: editorExtensions });
    editor.commands.setContent({ type: "doc", content: blocks });
    const md = getMarkdown(editor);
    editor.destroy();
    return md;
  }

  it("serializes empty paragraphs as blank-line markers", () => {
    const md = docMarkdown([
      { type: "paragraph", content: [{ type: "text", text: "a" }] },
      { type: "paragraph" },
      { type: "paragraph" },
      { type: "paragraph", content: [{ type: "text", text: "b" }] },
    ]);
    expect(md).toBe(`a\n\n${BLANK_MARK}\n\n${BLANK_MARK}\n\nb`);
  });

  it("round-trips blank-marker Markdown stably", () => {
    const md = `a\n\n${BLANK_MARK}\n\n${BLANK_MARK}\n\nb`;
    expect(roundTrip(md)).toBe(md);
  });

  it("does not leave stray markers in real content lines", () => {
    expect(roundTrip("hello world")).not.toContain(BLANK_MARK);
  });
});
