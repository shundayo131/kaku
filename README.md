# Kaku

A local-first Markdown writing app for macOS with inline AI editing.

Kaku (書く, "to write") edits real `.md` files in a folder you choose — no
account, no cloud sync, no backend. Your documents stay as plain Markdown on
disk, and your API key stays in the macOS Keychain.

## Features

- **WYSIWYG Markdown editor** (Tiptap) with a formatting toolbar — headings,
  bold/italic/strikethrough, inline code, links, lists, quotes, code blocks,
  tables, undo/redo.
- **Inline AI edit** — select text, describe a change (or use a quick action:
  fix grammar, shorten, lengthen, improve), preview the rewrite, accept or
  discard.
- **Local-first** — open or create real `.md` files; recent-docs sidebar;
  debounced autosave. YAML frontmatter and blank lines are preserved.
- **Bring your own key** — your Anthropic API key is stored in the macOS
  Keychain and used to call the model directly from your device. It is never
  sent anywhere else.

## Requirements

- macOS (Apple Silicon or Intel)
- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) (stable toolchain)
- Xcode Command Line Tools. If you use full Xcode, accept its license once:
  `sudo xcodebuild -license accept`

## Run locally

```bash
npm install
npm run tauri dev
```

The first launch compiles the Rust shell (a few minutes); subsequent launches
are fast and hot-reload the UI. This opens a native macOS window — it is not a
browser tab.

## Build a distributable

```bash
npm run tauri build   # produces a .app / .dmg under src-tauri/target/release/bundle
```

## Tests

```bash
npm test                     # frontend unit tests (Vitest)
cd src-tauri && cargo test   # Rust tests
```

## Using AI

Open **Settings** (gear, top-right) → paste your **Anthropic API key** and pick
a model id (e.g. `claude-sonnet-4-6`). Then select text in the editor and press
**⌘K** (or use the panel that appears) to edit it with AI.

> Only the Anthropic adapter is wired today. OpenAI, Gemini, and Kimi are
> planned — see [docs/STATUS.md](docs/STATUS.md).

## Tech stack

- **Shell:** [Tauri 2](https://tauri.app) (Rust backend, native macOS window)
- **UI:** React 19 + TypeScript + Vite
- **Editor:** Tiptap 3 + tiptap-markdown
- **Native:** `keyring` (Keychain), `reqwest` (model calls)

The key never enters frontend JavaScript: Rust stores it in the Keychain and
makes the API call. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/SECURITY.md](docs/SECURITY.md).

## Documentation

- [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md) — what Kaku is
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the TS / Rust boundary
- [docs/SECURITY.md](docs/SECURITY.md) — key handling + pre-release checklist
- [docs/STATUS.md](docs/STATUS.md) — what's done, open, and known tradeoffs

## License

MIT — see [LICENSE](LICENSE).
