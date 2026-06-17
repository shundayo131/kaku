type Props = {
  title: string;
  status: string;
  busy: boolean; // dirty or saving — tints the badge
  hasDoc: boolean;
  onOpenSettings: () => void;
};

const SettingsIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.88 1.2V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-2.88-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.4l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 6.6h.09A1.7 1.7 0 0 0 10 5.09V5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.88 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 21 13.4h.09" />
  </svg>
);

export function Titlebar({ title, status, busy, hasDoc, onOpenSettings }: Props) {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <span />
      <div className="title">
        {hasDoc ? (
          <>
            {title}
            <span className={`saved ${busy ? "dirty" : ""}`}>{status}</span>
          </>
        ) : (
          "Writer"
        )}
      </div>
      <div className="right">
        <button
          className="icon-btn"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          {SettingsIcon}
        </button>
      </div>
    </header>
  );
}
