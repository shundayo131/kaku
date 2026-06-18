import { useCallback, useMemo, useRef, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { useEditor, EditorContent } from "@tiptap/react";
import { editorExtensions } from "../lib/editor-extensions";
import { AiSuggestion, aiSuggestionKey } from "../lib/ai-suggestion";
import { getMarkdown } from "../lib/markdown";
import { useAiEdit } from "../hooks/useAiEdit";
import { Toolbar } from "./Toolbar";
import { InlineEdit } from "./InlineEdit";

type Props = {
  content: string; // initial Markdown (read once on mount; remount via key on doc switch)
  onChange: (markdown: string) => void;
};

/** WYSIWYG Markdown editor (Tiptap) with a formatting toolbar and inline AI edit. */
export function Editor({ content, onChange }: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<() => void>(() => {});
  // Resolved by the AiSuggestion extension's inline ✓/✕ buttons. Swapped each
  // render so the widget always calls the latest handlers.
  const handlersRef = useRef({ onAccept: () => {}, onReject: () => {} });
  const [suggesting, setSuggesting] = useState(false);

  const extensions = useMemo(
    () => [
      ...editorExtensions,
      AiSuggestion.configure({ getHandlers: () => handlersRef.current }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false, // toolbar subscribes via useEditorState
    onUpdate: ({ editor }) => {
      onChange(getMarkdown(editor));
    },
    onSelectionUpdate: ({ editor }: { editor: TiptapEditor }) => {
      // Editing (Delete/typing) collapses the selection → dismiss the panel.
      if (editor.state.selection.empty) closeRef.current();
    },
  });

  const { edit, hlRects, open, close, buildEditPrompt, runConversation, acceptEdit } =
    useAiEdit(editor, surfaceRef);

  const clearSuggestion = useCallback(() => {
    if (editor) editor.view.dispatch(editor.state.tr.setMeta(aiSuggestionKey, null));
  }, [editor]);

  // Push the latest draft into the editor as an inline suggestion.
  const showDraft = useCallback(
    (text: string) => {
      if (!editor || !edit) return;
      editor.view.dispatch(
        editor.state.tr.setMeta(aiSuggestionKey, {
          from: edit.from,
          to: edit.to,
          text,
        }),
      );
      setSuggesting(true);
    },
    [editor, edit],
  );

  const closeAll = useCallback(() => {
    clearSuggestion();
    setSuggesting(false);
    close();
  }, [clearSuggestion, close]);

  const acceptInline = useCallback(() => {
    if (!editor) return;
    const data = aiSuggestionKey.getState(editor.state);
    if (!data) return;
    clearSuggestion();
    acceptEdit(data.text); // replaces the selection range, then closes the panel
    setSuggesting(false);
  }, [editor, clearSuggestion, acceptEdit]);

  closeRef.current = closeAll;
  handlersRef.current = { onAccept: acceptInline, onReject: closeAll };

  const openFromSelection = (autoFocus: boolean) => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (!empty) open(from, to, autoFocus);
  };

  return (
    <div className="editor-shell">
      <Toolbar editor={editor} />
      <div className="editor-scroll">
        <div
          className="editor-surface"
          ref={surfaceRef}
          onMouseUp={() => openFromSelection(false)}
          onMouseDown={() => {
            if (edit) closeAll();
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
              e.preventDefault();
              openFromSelection(true);
            }
          }}
        >
          <EditorContent editor={editor} />
          {hlRects.length > 0 && !suggesting && (
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
        </div>
      </div>
      {edit && (
        <InlineEdit
          key={`${edit.from}-${edit.to}`}
          autoFocus={edit.autoFocus}
          original={edit.original}
          buildPrompt={buildEditPrompt}
          run={runConversation}
          onDraft={showDraft}
          onClose={closeAll}
        />
      )}
    </div>
  );
}
