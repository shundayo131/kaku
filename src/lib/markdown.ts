import { Editor } from "@tiptap/core";
import { editorExtensions, BLANK_MARK } from "./editor-extensions";

/** Serialize the editor to Markdown, keeping blank-line markers only on
 * otherwise-empty lines (stray markers in real content are stripped). */
export function getMarkdown(editor: Editor): string {
  const raw = (
    editor.storage as unknown as { markdown: { getMarkdown: () => string } }
  ).markdown.getMarkdown();
  return raw
    .split("\n")
    .map((line) => (line === BLANK_MARK ? line : line.split(BLANK_MARK).join("")))
    .join("\n");
}

/** Round-trip Markdown through the Tiptap document model: parse → serialize.
 * Used by tests to assert the editor preserves Markdown structure. */
export function roundTrip(markdown: string): string {
  const editor = new Editor({ extensions: editorExtensions, content: markdown });
  const out = getMarkdown(editor);
  editor.destroy();
  return out;
}
