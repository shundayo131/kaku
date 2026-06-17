# Product Scope

## Product Thesis

Build a native macOS Markdown writing app that feels fast, private, and durable.
The app should make AI editing feel like a local writing tool enhancement, not a
cloud document platform.

The core differentiator is trust: documents remain normal Markdown files in a
chosen folder, and users can leave the app at any time with no export step.

## Target User

- Writes long-form text: blog posts, articles, memos, proposals, strategy docs,
  essays, and business documents.
- Values ownership of files and compatibility with Git or other editors.
- Wants AI help inline while writing, but does not want a cloud workspace.
- Uses macOS and expects native keyboard, window, menu, and file behavior.

## Recommended MVP

The first usable version should prove the writing loop before adding ingestion,
automation, or advanced knowledge-base features.

1. Vault selection
   - Open an existing folder.
   - Remember recent vaults locally.
   - Restrict app file operations to the selected vault unless the user chooses
     another location.

2. Markdown file management
   - List `.md` files in a sidebar.
   - Create, rename, move, delete, and duplicate files.
   - Detect external file changes.
   - Keep save behavior predictable and visible.

3. Editor
   - Rich text editing for common Markdown constructs.
   - Markdown/source fallback so users can recover trust when rich editing is
     imperfect.
   - Headings, lists, blockquote, code, links, tables, horizontal rule, and task
     lists.
   - Minimal frontmatter preservation, even if frontmatter editing is not in the
     first UI.

4. Inline AI editing
   - Act on selected text.
   - Preset actions: improve, shorten, expand, change tone, summarize, fix
     grammar.
   - Custom instruction input.
   - Show proposed replacement as an accept/reject diff before mutating text.
   - Stream results where provider support allows.

5. Writing companion
   - Side panel chat scoped to the active document.
   - Explicit context controls: active file, selection, nearby section, or chosen
     files.
   - Insert, replace selection, or copy response.
   - Keep chat history local and clearly separate from the Markdown document.

6. Provider settings
   - Start with one provider adapter, but design the contract for many.
   - Store keys in macOS Keychain when possible.
   - Avoid exposing keys to frontend JavaScript.
   - Let users choose model, temperature, and max output where useful.

## Recommended Later Features

- Fast full-text search.
- Backlinks and outgoing links.
- Local embeddings for semantic search.
- PDF/DOCX/URL ingestion.
- Document outline and section navigation.
- Templates and snippets.
- Export to HTML, PDF, DOCX, or clipboard formats.
- Git status indicators and simple commit helper.
- Local model support through Ollama or LM Studio.

## Explicitly Defer

- Accounts.
- Cloud sync.
- Web backend.
- Multi-user collaboration.
- Mobile apps.
- Real-time CRDT editing.
- Plugin marketplace.
- Publishing platform.
- Custom proprietary document format.

## Stack Recommendation

The proposed stack is coherent for this product. I would keep it.

### Tauri 2

Use Tauri unless a blocker appears. It fits the local-first/security constraints:

- small native shell
- Rust access to filesystem and Keychain
- better secret boundary than a pure browser app
- native packaging path for macOS
- lower baseline memory footprint than Electron

Electron remains acceptable if Tauri blocks critical editor behavior, native menu
integration, updater/signing workflow, or dependency compatibility. Do not switch
only because Electron is familiar.

### React + TypeScript + Vite

Good choice for app UI and iteration speed. Keep the Tauri command boundary
typed so Rust and TypeScript contracts stay explicit.

### Tailwind CSS v4 + shadcn/ui + lucide-react

Good choice if the design stays application-like: dense, calm, keyboard-friendly,
and macOS-appropriate. Avoid a marketing-site visual language inside the app.

### Tiptap 3

Good choice for rich editing, but Markdown round-tripping is the major risk.
Treat the Markdown serializer/parser path as core infrastructure, not glue code.
Add tests early for frontmatter, tables, nested lists, links, code blocks, and
HTML passthrough decisions.

### AI Provider Layer

Do not start with a heavy orchestration framework unless it solves a concrete
need. For the MVP, a small internal provider interface is likely safer:

- `streamChat`
- `completeEdit`
- `listModels`
- `validateKey`
- provider capability metadata

Adapters can then wrap OpenAI, Anthropic, xAI/Grok, local OpenAI-compatible
servers, Ollama, or LM Studio. Add a framework later only if workflows need tool
graphs, memory orchestration, or complex agents.

## Suggested Architecture

```text
React UI
  editor, sidebar, command palette, settings, companion panel
    |
Typed Tauri commands/events
    |
Rust core
  vault service
  markdown file service
  filesystem watcher
  Keychain service
  provider adapters
  import/extraction services
    |
Local filesystem + macOS Keychain + selected AI provider APIs
```

## Important Data Boundaries

- Markdown files live in the user vault.
- App settings live in app config storage.
- API keys live in Keychain where possible.
- Chat transcripts should be local app data by default, not hidden in Markdown
  files.
- Derived indexes can be cached locally, but must be rebuildable from Markdown.

## First Technical Risks

- Markdown round-trip quality through Tiptap.
- Conflict handling when files change externally.
- Streaming AI responses from Rust to React cleanly.
- Keeping secrets out of JS, logs, and crash reports.
- Tauri filesystem permissions and path traversal hardening.
- Performance on large folders with many Markdown files.

## Proposed Build Order

1. Scaffold Tauri + React + TypeScript + Vite.
2. Add Tailwind v4, basic app shell, and shadcn/ui baseline.
3. Implement vault open/list/read/write commands in Rust.
4. Add file tree and plain text Markdown editor first.
5. Integrate Tiptap with Markdown load/save tests.
6. Add autosave/manual save policy and external change detection.
7. Add Keychain-backed provider settings.
8. Add first AI provider stream through Rust.
9. Add inline AI edit with accept/reject diff.
10. Add companion panel scoped to active document.

