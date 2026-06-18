import { useCallback, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import type { Rect } from "../types";
import { getActiveModel } from "../lib/model";
import { getAiPrefs } from "../lib/ai-prefs";
import { getMarkdown } from "../lib/markdown";
import { modelComplete, type ChatMessage } from "../lib/tauri/ai";

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
      setHlRects(rangeRects(editor, from, to, sr));
      setEdit({ from, to, original, autoFocus });
    },
    [editor, surfaceRef],
  );

  const close = useCallback(() => {
    setEdit(null);
    setHlRects([]);
  }, []);

  /** Build the opening user turn: just the instruction and the selection to
   * rewrite. The document is sent separately (see runConversation) so it can be
   * cache-controlled and reused across refine turns. */
  const buildEditPrompt = useCallback((instruction: string, original: string) => {
    return `Instruction: ${instruction}\n\nText to rewrite (a selection from the document):\n${original}`;
  }, []);

  /** Run a conversation through the active model and return the trimmed text.
   * Multi-turn: pass the running [user, assistant, user, …] history to refine.
   * The (capped) document is passed as cache-controlled context each call —
   * stable across refines, so prompt caching reuses it. */
  const runConversation = useCallback(
    async (messages: ChatMessage[]) => {
      const { provider, model } = getActiveModel();
      const { thinking, webSearch } = getAiPrefs();
      const doc = editor ? getMarkdown(editor).trim() : "";
      const documentContext = doc
        ? `Full document (for context only — do NOT rewrite all of it):\n"""\n${
            doc.length > MAX_CONTEXT_CHARS
              ? `${doc.slice(0, MAX_CONTEXT_CHARS)}\n…[truncated]`
              : doc
          }\n"""`
        : undefined;
      const text = await modelComplete({
        provider,
        model,
        system: EDIT_SYSTEM,
        messages,
        documentContext,
        maxTokens: 1024,
        thinking,
        webSearch,
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

  return { edit, hlRects, open, close, buildEditPrompt, runConversation, acceptEdit };
}
