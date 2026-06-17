import { useCallback, useMemo, useRef, useState } from "react";
import type { Doc } from "./types";
import { titleOf, nameOf, dirOf, ensureMd } from "./lib/paths";
import { pickFileToOpen, pickSavePath, writeDoc } from "./lib/tauri/fs";
import { useDocument } from "./hooks/useDocument";
import { useRecents } from "./hooks/useRecents";
import { useAutosave } from "./hooks/useAutosave";
import { Titlebar } from "./components/Titlebar";
import { Sidebar } from "./components/Sidebar";
import { Editor } from "./components/Editor";
import { Settings } from "./components/Settings";

export default function App() {
  const { content, dirty, saving, activePath, flush, load, adopt, setContent } =
    useDocument();
  const { recents, remember, forget } = useRecents();
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const vaultRef = useRef<string | null>(null); // default dir for new docs

  useAutosave(content, dirty, activePath, flush, setError);

  const openFile = useCallback(async () => {
    try {
      const file = await pickFileToOpen();
      if (!file) return;
      remember({ name: nameOf(file), path: file });
      vaultRef.current = dirOf(file);
      await load(file);
      setError(null);
    } catch (e) {
      setError(`Could not open file: ${String(e)}`);
    }
  }, [load, remember]);

  const openRecent = useCallback(
    async (doc: Doc) => {
      try {
        vaultRef.current = dirOf(doc.path);
        await load(doc.path);
        setError(null);
      } catch (e) {
        setError(`Could not open ${doc.name}: ${String(e)}`);
        forget(doc.path); // file moved or deleted
      }
    },
    [load, forget],
  );

  const newDocument = useCallback(async () => {
    try {
      const base = vaultRef.current ? `${vaultRef.current}/Untitled.md` : "Untitled.md";
      const path = await pickSavePath(base);
      if (!path) return;
      const target = ensureMd(path);
      await flush();
      await writeDoc(target, "");
      remember({ name: nameOf(target), path: target });
      vaultRef.current = dirOf(target);
      adopt(target, "");
      setError(null);
    } catch (e) {
      setError(`Could not create document: ${String(e)}`);
    }
  }, [flush, adopt, remember]);

  const activeName = activePath ? nameOf(activePath) : null;
  const wordCount = useMemo(() => {
    const t = content.trim();
    return t ? t.split(/\s+/).length : 0;
  }, [content]);
  const status = saving ? "Saving…" : dirty ? "Unsaved" : "Saved";

  return (
    <main className="app">
      <Titlebar
        title={activeName ? titleOf(activeName) : "Writer"}
        status={status}
        busy={dirty || saving}
        hasDoc={!!activeName}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <section className="workspace">
        <Sidebar
          recents={recents}
          activePath={activePath}
          onNew={newDocument}
          onOpenRecent={openRecent}
          onOpenFile={openFile}
        />

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

          {activeName ? (
            <Editor key={activePath} content={content} onChange={setContent} />
          ) : (
            <div className="editor-scroll">
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
            </div>
          )}
        </section>
      </section>

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </main>
  );
}
