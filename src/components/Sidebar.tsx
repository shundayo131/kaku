import type { Doc } from "../types";
import { titleOf } from "../lib/paths";

type Props = {
  recents: Doc[];
  activePath: string | null;
  onNew: () => void;
  onOpenRecent: (doc: Doc) => void;
  onOpenFile: () => void;
};

const PlusIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const FileIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flex: "none" }}>
    <path d="M4 5h7l2 2h7v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
  </svg>
);

export function Sidebar({ recents, activePath, onNew, onOpenRecent, onOpenFile }: Props) {
  return (
    <aside className="sidebar">
      <div className="side-head">
        <button className="new-doc" onClick={onNew}>
          {PlusIcon}
          New document
        </button>
      </div>

      <nav className="docs" aria-label="Recent documents">
        {recents.length > 0 && <div className="docs-label">Recent</div>}
        {recents.map((doc) => (
          <button
            key={doc.path}
            className={`doc ${doc.path === activePath ? "active" : ""}`}
            onClick={() => onOpenRecent(doc)}
            title={doc.path}
          >
            <span className="doc-name">{titleOf(doc.name)}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <button className="vault-pick" onClick={onOpenFile}>
          {FileIcon}
          <span className="path">Open a file…</span>
        </button>
      </div>
    </aside>
  );
}
