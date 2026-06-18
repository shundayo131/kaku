# Kaku

A local-first Markdown writing app for macOS with inline AI editing and an AI
writing companion.

## Product Direction

Kaku is a single-user desktop app. It edits real Markdown files in a folder
chosen by the user, similar to an Obsidian-style vault. There is no account
system, cloud sync, or backend server. The durable document format is plain
Markdown.

## Current Status

Planning and setup only. No application scaffold has been generated yet.

## Initial Scope

- Open a local vault folder.
- List, read, edit, and save `.md` files.
- Provide a fast rich editor backed by predictable Markdown serialization.
- Support inline AI editing on selected text.
- Support a companion chat scoped to the active document.
- Store provider API keys in macOS Keychain where possible.

## Stack Direction

- Tauri 2 for the native macOS shell and Rust backend.
- React, TypeScript, and Vite for UI.
- Tailwind CSS v4 and shadcn/ui primitives for styling and components.
- Tiptap 3 for rich editing.
- Provider abstraction for OpenAI, Anthropic, Grok, and local/open-source models.

## Open Decisions

- First AI provider to implement.
- Markdown parser/serializer strategy around Tiptap.
- Whether to support source mode in the first MVP or immediately after.
- Vault metadata strategy for app-only state such as recent files and UI prefs.
- Import scope for PDF, DOCX, and URL ingestion.

