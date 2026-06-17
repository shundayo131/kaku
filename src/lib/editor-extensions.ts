import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import { Markdown } from "tiptap-markdown";

// Zero-width space marks an intentionally-blank line, so empty paragraphs
// survive Markdown's normalization (which otherwise drops them). The marker is
// invisible in the editor and stripped from any line that has real content.
export const BLANK_MARK = "​";

// Paragraph that serializes an empty paragraph as a blank-marker line instead
// of being dropped.
const PreservingParagraph = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serialize(state: any, node: any) {
          if (node.content.size === 0) {
            state.write(BLANK_MARK);
          } else {
            state.renderInline(node);
          }
          state.closeBlock(node);
        },
      },
    };
  },
});

// Shared Tiptap extension set — used by the editor component AND the markdown
// round-trip tests, so they stay in sync.
export const editorExtensions = [
  StarterKit.configure({ paragraph: false }),
  PreservingParagraph,
  Markdown.configure({
    html: false, // keep output clean Markdown, no raw HTML
    linkify: false,
    breaks: false,
    transformPastedText: true,
  }),
];
