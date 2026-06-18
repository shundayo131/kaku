# Agent Instructions

This project is a local-first Markdown writing app for macOS. Treat it as a
single-user desktop product whose documents are ordinary `.md` files in a user
chosen folder.

## Product Principles

- Local-first: user documents are real Markdown files on disk, readable and
  editable by other tools.
- Transferable: no proprietary document database, no required account, no cloud
  sync, no backend service.
- Git-friendly: preserve plain text diffs; avoid hidden metadata inside document
  bodies unless explicitly designed and documented.
- Secret-safe: API keys must never be committed, logged, sent to app analytics,
  or exposed to frontend JavaScript if the Rust side can own the request.
- Native-feeling: prefer macOS-appropriate interactions, menus, file dialogs,
  keyboard shortcuts, and performance over web-app conventions.

## Preferred Stack

- Shell: Tauri 2 with Rust commands for privileged/native operations.
- UI: React + TypeScript + Vite.
- Styling: Tailwind CSS v4 with CSS-first theme tokens.
- Components: shadcn/ui primitives where useful, with lucide-react icons.
- Editor: Tiptap 3 for rich editing, with Markdown serialization as a first-class
  contract.
- AI: provider abstraction owned by the app, with request proxying through Rust
  when secrets are involved.
- Storage: Markdown files in the selected vault folder; app settings in app
  config storage; provider keys in macOS Keychain when possible.

## Architecture Boundaries

- Rust owns file IO, vault indexing, filesystem watching, Keychain access,
  native dialogs, document import helpers, and AI calls that require secrets.
- React owns editor UI, navigation, command palette, settings screens, document
  state display, and user interaction.
- Shared TypeScript types should model UI-facing command payloads. Do not let UI
  code reach directly into private filesystem or secret-handling behavior.
- Markdown is the durable format. Any rich editor behavior must round-trip to
  Markdown predictably.

## Security Requirements

- Do not place API keys in `.env` files as the primary product path.
- Do not log prompts, documents, provider responses, API keys, headers, or full
  request bodies by default.
- Keep provider adapters explicit. Each adapter should declare supported features
  such as streaming, tool use, structured output, and local model support.
- Treat imported PDFs, DOCX files, and URLs as untrusted input.
- Prefer least-privilege filesystem access scoped to the selected vault.

## Development Workflow

- Use `rtk` before shell commands when it is available, for example
  `rtk git status` or `rtk npm run build`.
- If `rtk` is unavailable in the current shell, use the raw command and mention
  the fallback in the work summary.
- Before editing, inspect existing files and follow established local patterns.
- Do not add or install any new package, library, crate, or dependency without
  explicit human approval first. This includes npm packages, Cargo crates, and
  Tauri plugins. Propose the dependency and the reason, then wait for sign-off.
- Keep implementation changes scoped. Avoid broad refactors during feature work.
- Add focused tests for Markdown round-tripping, file IO, provider adapters, and
  security-sensitive paths.
- Never commit secrets, generated build folders, local vault contents, or app
  signing/notarization credentials.
- Do not add `Co-Authored-By` trailers or other AI-attribution lines to commit
  messages.

## Initial Product Scope

Build the app in phases:

1. Vault open/list/read/write for `.md` files.
2. Rich Markdown editor with reliable save/load and preview/source escape hatch.
3. Inline AI edit flow for selected text.
4. Companion chat scoped to the active document and optional selected context.
5. Provider settings and Keychain-backed API key storage.
6. File search and basic backlinks after core editing is stable.
7. Source ingestion for PDF/DOCX/URL after the writing loop is strong.

Defer cloud sync, accounts, collaboration, mobile, plugins, publishing pipelines,
and proprietary document features until the local writing workflow is proven.

