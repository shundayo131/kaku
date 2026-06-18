import { useCallback, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import type { Rect } from "../types";
import { getActiveModel } from "../lib/model";
import { getMarkdown } from "../lib/markdown";
import { modelComplete } from "../lib/tauri/ai";

const EDIT_SYSTEM =
  "You are an inline editor in a Markdown writing app. You rewrite the user's " +
  "SELECTED text to satisfy their instruction. You may be given the full " +
  "document for context — use it to match the surrounding voice, terminology, " +
  "and flow, but rewrite ONLY the selected text. Output ONLY the rewritten " +
  "selection — no preamble, quotation marks, code fences, or commentary. " +
  "Preserve the author's voice.";

/** Cap on document context sent for an edit — keeps prompts cheap. Most docs
 * are well under this; longer ones are truncated (the selection is sent in
 * full regardless, so context loss is graceful). */
const MAX_CONTEXT_CHARS = 12000;

type Edit = {
  from: number;
  to: number;
  original: string;
  top: number;
  autoFocus: boolean;
};

/** Rectangles covering the selection, relative to the surface — via a DOM Range
 * (survives the editor losing focus, unlike ProseMirror's own selection). */
function rangeRects(
  editor: Editor,
  from: number,
  to: number,
  surfaceRect: DOMRect,
): Rect[] {
  try {
    const a = editor.view.domAtPos(from);
    const b = editor.view.domAtPos(to);
    const range = document.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    return Array.from(range.getClientRects()).map((r) => ({
      left: r.left - surfaceRect.left,
      top: r.top - surfaceRect.top,
      width: r.width,
      height: r.height,
    }));
  } catch {
    return [];
  }
}

/** Select text → inline edit panel → AI rewrite → accept, over a Tiptap editor. */
export function useAiEdit(
  editor: Editor | null,
  surfaceRef: RefObject<HTMLDivElement | null>,
) {
  const [edit, setEdit] = useState<Edit | null>(null);
  const [hlRects, setHlRects] = useState<Rect[]>([]);

  const open = useCallback(
    (from: number, to: number, autoFocus: boolean) => {
      const surface = surfaceRef.current;
      if (!editor || !surface || from === to) return;
      const original = editor.state.doc.textBetween(from, to, "\n");
      const sr = surface.getBoundingClientRect();
      const coords = editor.view.coordsAtPos(to);
      setHlRects(rangeRects(editor, from, to, sr));
      setEdit({ from, to, original, top: coords.bottom - sr.top + 6, autoFocus });
    },
    [editor, surfaceRef],
  );

  const close = useCallback(() => {
    setEdit(null);
    setHlRects([]);
  }, []);

  const requestEdit = useCallback(
    async (instruction: string, original: string) => {
      const { provider, model } = getActiveModel();
      const doc = editor ? getMarkdown(editor).trim() : "";
      const context =
        doc && doc !== original.trim()
          ? `Full document (for context only — do NOT rewrite all of it):\n"""\n${
              doc.length > MAX_CONTEXT_CHARS
                ? `${doc.slice(0, MAX_CONTEXT_CHARS)}\n…[truncated]`
                : doc
            }\n"""\n\n`
          : "";
      const text = await modelComplete({
        provider,
        model,
        system: EDIT_SYSTEM,
        prompt: `${context}Instruction: ${instruction}\n\nText to rewrite (a selection from the document above):\n${original}`,
        maxTokens: 1024,
      });
      return text.trim();
    },
    [editor],
  );

  const acceptEdit = useCallback(
    (result: string) => {
      if (!editor || !edit) return;
      editor
        .chain()
        .focus()
        .insertContentAt({ from: edit.from, to: edit.to }, result)
        .run();
      close();
    },
    [editor, edit, close],
  );

  return { edit, hlRects, open, close, requestEdit, acceptEdit };
}
