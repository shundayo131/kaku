# Status & Backlog

Snapshot of what's built and what's open. See also [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md),
[ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md), and `git log`.

_Last updated: 2026-06-18._

## Done

- **File loop** (TS via Tauri `fs`/`dialog` plugins): open/create `.md`, recent-docs
  sidebar (localStorage), debounced autosave, ⌘S.
- **Modular codebase**: `lib/` (pure) · `hooks/` · `components/`; Vitest + jsdom.
  **35 tests** (paths, storage, recents, model, markdown round-trip, blank-line
  preservation, frontmatter; Rust: API-key scrub).
- **Keychain key management** (Rust `keyring`): set/list/delete per provider,
  masked in UI, never returned to JS. Settings UI + active-model selector +
  disclosure copy.
- **AI gateway** (Rust, non-streaming `model_complete`): **Anthropic adapter only**,
  multi-turn `messages[]`, optional extended thinking + server-side web-search
  tool, multi-block response parsing, outbound `sk-…` scrub.
- **WYSIWYG editor** (Tiptap + tiptap-markdown): toolbar (Text/H1–H3, bold,
  italic, strike, inline code, link, lists, quote, code block, **table**,
  undo/redo), Markdown round-trip.
- **Inline AI edit** (Cursor-style): select → floating box **above** the
  selection → quick actions or multi-line instruction → draft. The whole
  document is sent as cache-controlled context. Drafts render **inline as an
  old(red)→new(green) diff** with a **Keep ⌘Y / Undo ⌘N** bar at the diff; the
  box stays above (outside the diff) as a **multi-turn refine** input. Doesn't
  steal editor focus. Thinking on by default; web search opt-in via Settings
  (off by default — queries leave the device).
- **Blank-line preservation** (invisible ZWSP marker on empty paragraphs).
- **Frontmatter passthrough**: YAML block sliced on load, reattached byte-exact
  on save.
- **Native window dragging** from the custom title bar.

## Open / deferred

1. **Math** (block + inline). Deps installed (`@tiptap/extension-mathematics`,
   `katex@0.16`) but **unwired** — the extension's markdown hooks don't match
   tiptap-markdown, so `$…$` needs a custom parse + serialize bridge. Its own task.
2. **Other model adapters**: only Anthropic is wired. OpenAI + Kimi
   (OpenAI-compatible) and Gemini (Google) return "not supported". See
   ARCHITECTURE.md for the 3-adapter plan.
3. **Streaming**: `model_complete` is non-streaming. Streaming gateway (Channel)
   for chat + longer generations.
4. **Companion chat panel**: original scope (ask / write / propose-edit) not
   built — only the inline-edit flow exists.
5. **Markdown source-reveal** (editing raw `#`/syntax): undecided design question
   vs. the WYSIWYG T/H1–H3 buttons.
6. **Pre-release security** (see SECURITY.md checklist): code-sign + notarize,
   set a real CSP (`tauri.conf.json` `csp` is `null`), tighten fs scope from
   `$HOME/**` toward the vault, sanitize untrusted render.
7. **Images in the editor** (paste / drag-drop / upload). Scoped, not built.
   Local-first design: save bytes to a file (`<docDir>/assets/<name>.ext`) and
   reference by **relative path** in Markdown (`![](assets/…)`) — never base64.
   Pieces: Rust `save_asset(doc_path, bytes, ext)` command; ProseMirror
   `handlePaste`/`handleDrop` + a toolbar upload button; a custom Tiptap image
   node (no new dep) whose `renderHTML` resolves the relative path to an
   `asset://` URL via `convertFileSrc`, while keeping the stored `src` relative
   for the Markdown round-trip; enable + **scope** `app.security.assetProtocol`
   in `tauri.conf.json` so the webview may load local files. Open decision:
   storage location (recommended `assets/` next to the doc). Ties into the
   item-6 security work (asset scope, untrusted image handling).

## Known debt / tradeoffs

- Blank lines stored with invisible zero-width markers (chosen tradeoff).
- `tiptap-markdown` is community, `0.9.0` — watch maintenance.
- JS bundle ~800 kB (Tiptap/ProseMirror); loads from disk, fine for desktop.
- `npm audit`: 1 low (esbuild dev-server, Windows-only, dev-only).
- Styling is **plain CSS + design tokens** by design (see STYLE.md); `lint:css`
  bans raw colors outside `tokens.css`. No Tailwind/shadcn (documented choice).
- Unsigned dev builds → macOS Keychain re-prompts after rebuilds (signed
  release builds won't).
- Six declared-but-unused deps (`katex`, `@tiptap/extension-mathematics`,
  `@tiptap/extension-link`, `@tiptap/extension-table-{cell,header,row}`) —
  tree-shaken out of the bundle; removable when math is wired or as cleanup.
- Inline AI suggestion (Phase D) is best-effort for multi-paragraph selections;
  needs a live run to validate the ProseMirror decoration UX end-to-end.

## Identity (for any rename)

App/Keychain identity lives in `src-tauri/tauri.conf.json` (`identifier`,
`productName`) and `keys.rs` `SERVICE` (`com.shunito.kaku`). Renaming the repo
**folder** does not affect these. Renaming the **app** would change the Keychain
service name and need a one-time key migration.
