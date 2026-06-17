import { useCallback, useLayoutEffect, useState, type RefObject } from "react";
import type { EditState, Rect } from "../types";
import { caretCoords, selectionRects } from "../lib/textarea-measure";
import { getActiveModel } from "../lib/model";
import { modelComplete } from "../lib/tauri/ai";

const EDIT_SYSTEM =
  "You are an inline editor in a Markdown writing app. Rewrite the user's " +
  "selected text to satisfy their instruction. Output ONLY the rewritten text " +
  "— no preamble, quotation marks, code fences, or commentary. Preserve " +
  "Markdown formatting and the author's voice.";

/** The ⌘K / select-to-edit inline editing flow over a textarea. */
export function useInlineEdit(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  content: string,
  onContentChange: (next: string) => void,
) {
  const [edit, setEdit] = useState<EditState | null>(null);
  const [hlRects, setHlRects] = useState<Rect[]>([]);

  // Persist the selection highlight while the panel is open (the native
  // textarea highlight disappears once focus moves to the panel).
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !edit || edit.start === edit.end) {
      setHlRects([]);
      return;
    }
    setHlRects(selectionRects(ta, edit.start, edit.end));
  }, [edit, content, textareaRef]);

  const openEditAt = useCallback(
    (start: number, end: number) => {
      const ta = textareaRef.current;
      if (!ta || start === end) return;
      const c = caretCoords(ta, end);
      setEdit({
        start,
        end,
        original: content.slice(start, end),
        top: c.top + c.lineHeight + 6,
      });
    },
    [content, textareaRef],
  );

  const onMouseUp = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd } = ta;
    if (selectionStart !== selectionEnd) openEditAt(selectionStart, selectionEnd);
  }, [openEditAt, textareaRef]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const ta = textareaRef.current;
        if (ta) openEditAt(ta.selectionStart, ta.selectionEnd);
      }
    },
    [openEditAt, textareaRef],
  );

  const close = useCallback(() => setEdit(null), []);

  const requestEdit = useCallback(
    async (instruction: string, original: string) => {
      const { provider, model } = getActiveModel();
      const text = await modelComplete({
        provider,
        model,
        system: EDIT_SYSTEM,
        prompt: `Instruction: ${instruction}\n\nText to rewrite:\n${original}`,
        maxTokens: 1024,
      });
      return text.trim();
    },
    [],
  );

  const acceptEdit = useCallback(
    (result: string) => {
      if (!edit) return;
      const next =
        content.slice(0, edit.start) + result + content.slice(edit.end);
      onContentChange(next);
      setEdit(null);
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(edit.start, edit.start + result.length);
        }
      });
    },
    [edit, content, onContentChange, textareaRef],
  );

  return { edit, hlRects, onMouseUp, onKeyDown, close, requestEdit, acceptEdit };
}
