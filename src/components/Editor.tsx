import { useLayoutEffect, useRef } from "react";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { InlineEdit } from "./InlineEdit";

type Props = {
  content: string;
  onChange: (next: string) => void;
};

/** The Markdown writing surface + inline AI editing (select → ⌘K → edit). */
export function Editor({ content, onChange }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { edit, hlRects, onMouseUp, onKeyDown, close, requestEdit, acceptEdit } =
    useInlineEdit(textareaRef, content, onChange);

  // Grow the textarea to its content height so the outer container scrolls
  // (no internal textarea scroll) — keeps the doc top-anchored and the
  // selection-highlight overlay aligned.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const scroll = ta.closest(".editor-scroll") as HTMLElement | null;
    const min = scroll ? scroll.clientHeight : 0;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(ta.scrollHeight, min)}px`;
  }, [content]);

  return (
    <div className="editor-surface">
      {hlRects.length > 0 && (
        <div className="sel-highlight-layer" aria-hidden="true">
          {hlRects.map((r, i) => (
            <div
              key={i}
              className="sel-highlight"
              style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
            />
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        className="markdown-input"
        value={content}
        placeholder="Write in Markdown…"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onMouseUp={onMouseUp}
        onMouseDown={() => {
          if (edit) close();
        }}
        spellCheck
      />
      {edit && (
        <InlineEdit
          top={edit.top}
          original={edit.original}
          requestEdit={requestEdit}
          onAccept={acceptEdit}
          onClose={close}
        />
      )}
    </div>
  );
}
