import { type Editor, useEditorState } from "@tiptap/react";

function promptLink(editor: Editor) {
  const prev = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link URL", prev ?? "https://");
  if (url === null) return;
  if (url === "") {
    editor.chain().focus().unsetLink().run();
    return;
  }
  editor.chain().focus().toggleLink({ href: url }).run();
}

export function Toolbar({ editor }: { editor: Editor | null }) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({
      para:
        (editor?.isActive("paragraph") ?? false) &&
        !(editor?.isActive("heading") ?? false),
      h1: editor?.isActive("heading", { level: 1 }) ?? false,
      h2: editor?.isActive("heading", { level: 2 }) ?? false,
      h3: editor?.isActive("heading", { level: 3 }) ?? false,
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      strike: editor?.isActive("strike") ?? false,
      code: editor?.isActive("code") ?? false,
      link: editor?.isActive("link") ?? false,
      bullet: editor?.isActive("bulletList") ?? false,
      ordered: editor?.isActive("orderedList") ?? false,
      quote: editor?.isActive("blockquote") ?? false,
      codeBlock: editor?.isActive("codeBlock") ?? false,
      canUndo: editor?.can().undo() ?? false,
      canRedo: editor?.can().redo() ?? false,
    }),
  });

  if (!editor || !s) return <div className="format-toolbar" />;
  const c = () => editor.chain().focus();

  return (
    <div className="format-toolbar" role="toolbar" aria-label="Formatting">
      <button className={`tb ${s.para ? "on" : ""}`} title="Text (normal paragraph)"
        onClick={() => c().setParagraph().run()}>T</button>
      <button className={`tb ${s.h1 ? "on" : ""}`} title="Heading 1"
        onClick={() => c().toggleHeading({ level: 1 }).run()}>H1</button>
      <button className={`tb ${s.h2 ? "on" : ""}`} title="Heading 2"
        onClick={() => c().toggleHeading({ level: 2 }).run()}>H2</button>
      <button className={`tb ${s.h3 ? "on" : ""}`} title="Heading 3"
        onClick={() => c().toggleHeading({ level: 3 }).run()}>H3</button>

      <span className="tb-sep" />

      <button className={`tb ${s.bold ? "on" : ""}`} title="Bold (⌘B)"
        onClick={() => c().toggleBold().run()}><strong>B</strong></button>
      <button className={`tb ${s.italic ? "on" : ""}`} title="Italic (⌘I)"
        onClick={() => c().toggleItalic().run()}><em>I</em></button>
      <button className={`tb ${s.strike ? "on" : ""}`} title="Strikethrough"
        onClick={() => c().toggleStrike().run()}><s>S</s></button>
      <button className={`tb ${s.code ? "on" : ""}`} title="Inline code"
        onClick={() => c().toggleCode().run()}>{"<>"}</button>
      <button className={`tb ${s.link ? "on" : ""}`} title="Link"
        onClick={() => promptLink(editor)}>🔗</button>

      <span className="tb-sep" />

      <button className={`tb ${s.bullet ? "on" : ""}`} title="Bullet list"
        onClick={() => c().toggleBulletList().run()}>• —</button>
      <button className={`tb ${s.ordered ? "on" : ""}`} title="Numbered list"
        onClick={() => c().toggleOrderedList().run()}>1.</button>
      <button className={`tb ${s.quote ? "on" : ""}`} title="Quote"
        onClick={() => c().toggleBlockquote().run()}>&ldquo;</button>
      <button className={`tb ${s.codeBlock ? "on" : ""}`} title="Code block"
        onClick={() => c().toggleCodeBlock().run()}>{"{ }"}</button>

      <span className="tb-sep" />

      <button className="tb" title="Undo (⌘Z)" disabled={!s.canUndo}
        onClick={() => c().undo().run()}>↶</button>
      <button className="tb" title="Redo (⌘⇧Z)" disabled={!s.canRedo}
        onClick={() => c().redo().run()}>↷</button>
    </div>
  );
}
