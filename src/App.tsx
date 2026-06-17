import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { Settings } from "./Settings";
import { InlineEdit } from "./InlineEdit";
import { getActiveModel } from "./model";

type Doc = {
  name: string; // file name, e.g. "Local-first AI writing.md"
  path: string; // absolute path
};

type EditState = {
  start: number;
  end: number;
  original: string;
  top: number; // px from the top of the editor surface
};

const RECENTS_KEY = "writer.recents.v1";
const RECENTS_MAX = 30;
const AUTOSAVE_MS = 600;

const EDIT_SYSTEM =
  "You are an inline editor in a Markdown writing app. Rewrite the user's " +
  "selected text to satisfy their instruction. Output ONLY the rewritten text " +
  "— no preamble, quotation marks, code fences, or commentary. Preserve " +
  "Markdown formatting and the author's voice.";

const titleOf = (name: string) => name.replace(/\.md$/i, "");
const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const dirOf = (path: string) => path.slice(0, path.lastIndexOf("/"));

function loadRecents(): Doc[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as Doc[]) : [];
  } catch {
    return [];
  }
}

// Measure the y (px, relative to the textarea's top) just below the line that
// contains `pos`, by mirroring the textarea's layout in a hidden div.
const STYLE_PROPS = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "wordSpacing",
] as const;

type Coords = { left: number; top: number; lineHeight: number };

function caretCoords(ta: HTMLTextAreaElement, pos: number): Coords {
  const cs = getComputedStyle(ta);
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
  const parent = ta.parentElement;
  if (!parent) return { left: 56, top: 0, lineHeight };
  const div = document.createElement("div");
  const s = div.style;
  s.position = "absolute";
  s.visibility = "hidden";
  s.top = "0";
  s.left = "0";
  s.whiteSpace = "pre-wrap";
  s.overflowWrap = "break-word";
  s.wordBreak = "break-word";
  for (const p of STYLE_PROPS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as any)[p] = (cs as any)[p];
  }
  div.textContent = ta.value.slice(0, pos);
  const marker = document.createElement("span");
  marker.textContent = ta.value.slice(pos) || ".";
  div.appendChild(marker);
  parent.appendChild(div);
  const coords = { left: marker.offsetLeft, top: marker.offsetTop, lineHeight };
  parent.removeChild(div);
  return coords;
}

type Rect = { left: number; top: number; width: number; height: number };

// Rectangles (one per visual line) covering [start, end), relative to the
// editor surface — used to draw a selection highlight that persists when the
// textarea loses focus.
function selectionRects(
  ta: HTMLTextAreaElement,
  start: number,
  end: number,
): Rect[] {
  const cs = getComputedStyle(ta);
  const parent = ta.parentElement;
  if (!parent) return [];
  const div = document.createElement("div");
  const s = div.style;
  s.position = "absolute";
  s.visibility = "hidden";
  s.top = "0";
  s.left = "0";
  s.whiteSpace = "pre-wrap";
  s.overflowWrap = "break-word";
  s.wordBreak = "break-word";
  for (const p of STYLE_PROPS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as any)[p] = (cs as any)[p];
  }
  div.appendChild(document.createTextNode(ta.value.slice(0, start)));
  const span = document.createElement("span");
  span.textContent = ta.value.slice(start, end) || " ";
  div.appendChild(span);
  div.appendChild(document.createTextNode(ta.value.slice(end)));
  parent.appendChild(div);
  const pr = parent.getBoundingClientRect();
  const rects = Array.from(span.getClientRects()).map((r) => ({
    left: r.left - pr.left,
    top: r.top - pr.top,
    width: r.width,
    height: r.height,
  }));
  parent.removeChild(div);
  return rects;
}

export default function App() {
  const [vault, setVault] = useState<string | null>(null); // default dir for new docs
  const [recents, setRecents] = useState<Doc[]>(loadRecents);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [hlRects, setHlRects] = useState<Rect[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Latest active doc state, for flush-on-switch without stale closures.
  const liveRef = useRef({ activePath, content, dirty });
  liveRef.current = { activePath, content, dirty };

  const activeName = activePath ? nameOf(activePath) : null;

  const wordCount = useMemo(() => {
    const t = content.trim();
    return t ? t.split(/\s+/).length : 0;
  }, [content]);

  const status = saving ? "Saving…" : dirty ? "Unsaved" : "Saved";

  const rememberRecent = useCallback((doc: Doc) => {
    setRecents((prev) => {
      const next = [doc, ...prev.filter((d) => d.path !== doc.path)].slice(
        0,
        RECENTS_MAX,
      );
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const forgetRecent = useCallback((path: string) => {
    setRecents((prev) => {
      const next = prev.filter((d) => d.path !== path);
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Write current buffer to disk if it has unsaved edits.
  const flush = useCallback(async () => {
    const { activePath: p, content: c, dirty: d } = liveRef.current;
    if (!p || !d) return;
    setSaving(true);
    try {
      await writeTextFile(p, c);
      setDirty(false);
      setError(null);
    } catch (e) {
      setError(`Could not save: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }, []);

  // Load a file into the editor, flushing any unsaved edits in the current doc.
  const loadInto = useCallback(
    async (path: string) => {
      await flush();
      const text = await readTextFile(path);
      setActivePath(path);
      setContent(text);
      setDirty(false);
      setVault(dirOf(path));
      setEdit(null);
      setError(null);
    },
    [flush],
  );

  const openFile = useCallback(async () => {
    try {
      const file = await open({
        directory: false,
        multiple: false,
        filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
      });
      if (typeof file !== "string") return;
      rememberRecent({ name: nameOf(file), path: file });
      await loadInto(file);
    } catch (e) {
      setError(`Could not open file: ${String(e)}`);
    }
  }, [loadInto, rememberRecent]);

  const openRecent = useCallback(
    async (doc: Doc) => {
      try {
        await loadInto(doc.path);
      } catch (e) {
        setError(`Could not open ${doc.name}: ${String(e)}`);
        forgetRecent(doc.path); // file moved or deleted
      }
    },
    [loadInto, forgetRecent],
  );

  const newDocument = useCallback(async () => {
    try {
      const path = await saveDialog({
        defaultPath: vault ? `${vault}/Untitled.md` : "Untitled.md",
        filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
      });
      if (typeof path !== "string") return;
      const target = /\.md$/i.test(path) ? path : `${path}.md`;
      await flush();
      await writeTextFile(target, "");
      rememberRecent({ name: nameOf(target), path: target });
      setActivePath(target);
      setContent("");
      setDirty(false);
      setVault(dirOf(target));
      setEdit(null);
      setError(null);
    } catch (e) {
      setError(`Could not create document: ${String(e)}`);
    }
  }, [vault, flush, rememberRecent]);

  // Debounced auto-save while typing.
  useEffect(() => {
    if (!dirty || !activePath) return;
    const t = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [content, dirty, activePath, flush]);

  // Cmd/Ctrl+S forces an immediate save.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flush]);

  // Grow the textarea to fit its content so the outer container scrolls (no
  // internal textarea scroll) — keeps the doc starting at the top and lets the
  // selection-highlight overlay stay aligned with the text.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const scroll = ta.closest(".editor-scroll") as HTMLElement | null;
    const min = scroll ? scroll.clientHeight : 0;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(ta.scrollHeight, min)}px`;
  }, [content, activePath]);

  // Keep the selected range highlighted while the button/panel is shown — the
  // native textarea highlight vanishes once focus moves to the panel.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    const range = edit;
    if (!ta || !range || range.start === range.end) {
      setHlRects([]);
      return;
    }
    setHlRects(selectionRects(ta, range.start, range.end));
  }, [edit, content]);

  // Open the inline editor for a selection range, anchored below it.
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
    [content],
  );

  // Selecting text with the mouse opens the edit window directly.
  const onMouseUp = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd } = ta;
    if (selectionStart !== selectionEnd) openEditAt(selectionStart, selectionEnd);
  }, [openEditAt]);

  const onEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const ta = textareaRef.current;
        if (ta) openEditAt(ta.selectionStart, ta.selectionEnd);
      }
    },
    [openEditAt],
  );

  const requestEdit = useCallback(
    async (instruction: string, original: string) => {
      const { provider, model } = getActiveModel();
      const text = await invoke<string>("model_complete", {
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
      const next = content.slice(0, edit.start) + result + content.slice(edit.end);
      setContent(next);
      setDirty(true);
      setEdit(null);
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(edit.start, edit.start + result.length);
        }
      });
    },
    [edit, content],
  );

  return (
    <main className="app">
      <header className="titlebar" data-tauri-drag-region>
        <span />
        <div className="title">
          {activeName ? (
            <>
              {titleOf(activeName)}
              <span className={`saved ${dirty || saving ? "dirty" : ""}`}>
                {status}
              </span>
            </>
          ) : (
            "Writer"
          )}
        </div>
        <div className="right">
          <button
            className="icon-btn"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            aria-label="Settings"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.88 1.2V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-2.88-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.4l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 6.6h.09A1.7 1.7 0 0 0 10 5.09V5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.88 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 21 13.4h.09" />
            </svg>
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="side-head">
            <button className="new-doc" onClick={newDocument}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              New document
            </button>
          </div>

          <nav className="docs" aria-label="Recent documents">
            {recents.length > 0 && <div className="docs-label">Recent</div>}
            {recents.map((doc) => (
              <button
                key={doc.path}
                className={`doc ${doc.path === activePath ? "active" : ""}`}
                onClick={() => void openRecent(doc)}
                title={doc.path}
              >
                <span className="doc-name">{titleOf(doc.name)}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-foot">
            <button className="vault-pick" onClick={openFile}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                style={{ flex: "none" }}
              >
                <path d="M4 5h7l2 2h7v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
              </svg>
              <span className="path">Open a file…</span>
            </button>
          </div>
        </aside>

        <section className="editor-pane">
          <div className="doc-toolbar">
            <div>
              <div className="doc-title">
                {activeName ? titleOf(activeName) : "No document"}
              </div>
              <div className="doc-sub">
                {activeName
                  ? `${wordCount} words · Markdown · ${status}`
                  : "Open or create a document to begin"}
              </div>
            </div>
            {activeName && (
              <div className="hint-kbd">Select text to edit with AI</div>
            )}
          </div>

          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => setError(null)} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}

          <div className="editor-scroll">
            {activeName ? (
              <div className="editor-surface">
                {hlRects.length > 0 && (
                  <div className="sel-highlight-layer" aria-hidden="true">
                    {hlRects.map((r, i) => (
                      <div
                        key={i}
                        className="sel-highlight"
                        style={{
                          left: r.left,
                          top: r.top,
                          width: r.width,
                          height: r.height,
                        }}
                      />
                    ))}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  className="markdown-input"
                  value={content}
                  placeholder="Write in Markdown…"
                  onChange={(e) => {
                    setContent(e.target.value);
                    setDirty(true);
                  }}
                  onKeyDown={onEditorKeyDown}
                  onMouseUp={onMouseUp}
                  onMouseDown={() => {
                    if (edit) setEdit(null);
                  }}
                  spellCheck
                />
                {edit && (
                  <InlineEdit
                    top={edit.top}
                    original={edit.original}
                    requestEdit={requestEdit}
                    onAccept={acceptEdit}
                    onClose={() => setEdit(null)}
                  />
                )}
              </div>
            ) : (
              <div className="empty">
                <h2>Start writing</h2>
                <p>
                  Writer edits ordinary Markdown files on disk. Open one, or
                  create a new document — nothing is copied into a hidden
                  database.
                </p>
                <div className="empty-actions">
                  <button className="btn-primary" onClick={openFile}>
                    Open a Markdown file…
                  </button>
                  <button className="btn-link" onClick={newDocument}>
                    or create a new document
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </section>

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </main>
  );
}
