import { useRef } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { useEditor, EditorContent } from "@tiptap/react";
import { editorExtensions } from "../lib/editor-extensions";
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

  const editor = useEditor({
    extensions: editorExtensions,
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
  closeRef.current = close;

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
            if (edit) close();
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
              e.preventDefault();
              openFromSelection(true);
            }
          }}
        >
          <EditorContent editor={editor} />
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
          {edit && (
            <InlineEdit
              key={`${edit.from}-${edit.to}`}
              top={edit.top}
              original={edit.original}
              autoFocus={edit.autoFocus}
              buildPrompt={buildEditPrompt}
              run={runConversation}
              onAccept={acceptEdit}
              onClose={close}
            />
          )}
        </div>
      </div>
    </div>
  );
}
