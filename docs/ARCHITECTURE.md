# Architecture — TS / Rust Boundary

Build reference for how responsibility splits between the React/TypeScript
frontend and the Rust (Tauri) backend. See also [PRODUCT_SCOPE.md](./PRODUCT_SCOPE.md),
[SECURITY.md](./SECURITY.md), and the root `AGENTS.md`.

## Decision: thin Rust gateway, TS orchestration

For an interactive, single-user macOS writing assistant, **TS owns the app logic
(including the agent loop) and Rust is a thin, well-bounded gateway** for the one
thing that genuinely requires native code: the API key.

Why not "Rust owns the whole engine"? The agent's job is to edit the document the
user is looking at — the live buffer, cursor, selection, and the Accept/Reject UX
all live in TS. Putting the loop in Rust would sit it across a process boundary
from the very thing it orchestrates, forcing constant round-trips. The loop
belongs where the context and the UI are. The Anthropic TypeScript SDK also gives
streaming, tool use, and structured output first-class. So the loop is TS.

Rust stays for exactly the part with **no JS equivalent**: storing the key in the
macOS Keychain and being the single network egress that injects the auth header.
That is small but load-bearing and has a clean request/response boundary — not the
"tiny-knit, entangled" sliver we wanted to avoid.

## Guiding principles

1. **TS owns the Mac UI and orchestration** — editor, navigation, chat panel,
   settings, the agent loop, tool definitions/dispatch, and all editor-acting
   tools.
2. **Rust owns the secret boundary** — Keychain key storage and the single
   outbound gateway to the model provider. The raw key never enters JS.
3. **Native only where there is no JS equivalent.** Keychain access and the
   secret-bearing egress qualify; orchestration does not.

## The LLM does not "touch the UI"

The model only ever emits **text** or **tool calls** (structured JSON). The app
defines which tools exist, executes them, and feeds results back. "Agentic"
behavior is just a loop: call model → tool_use → run tool → return result →
repeat until the model returns plain text. The model can do exactly what the tool
schema allows and nothing more. Every **mutating** tool is gated by explicit user
approval (the diff Accept/Reject), so edits are always human-in-the-loop.

## Responsibility split

### Rust — the gateway (the only native code)

- **Keychain**: store / read / delete the user's API key(s). See
  *Settings & key management* below.
- **Model egress**: a streaming proxy command. TS hands it a provider id + request
  body; Rust reads that provider's key from Keychain, applies the right **adapter**
  (endpoint + auth header + stream format), makes the HTTPS call, and pipes a
  normalized token stream back over a Channel. The raw key is never returned to JS.

  **Provider adapters — 4 providers, 3 API shapes:**

  | Adapter | Covers | Auth |
  | --- | --- | --- |
  | OpenAI-compatible | OpenAI, **Kimi** (Moonshot), later Ollama/local + OpenRouter | `Authorization: Bearer` |
  | Anthropic (native) | Claude | `x-api-key` + `anthropic-version` |
  | Google (native) | Gemini | `x-goog-api-key` |

  The adapter normalizes each provider's stream into a uniform `token(delta)` event,
  so TS sees one streaming shape regardless of provider. The **model id is
  user-specified per provider** (a settings field with a sensible default) — no
  hardcoded model lists to go stale.
- **Outbound scrub**: before sending, redact API-key-like patterns from the body
  as defense in depth (see [SECURITY.md](./SECURITY.md)).
- *Future, only if perf demands it:* vault indexing / fast search can migrate to
  Rust. Not v1.

**Auth is gateway-abstracted.** v1 uses the BYO API-key model (the gateway injects
an `x-api-key` header). Consumer subscriptions (ChatGPT Plus, Gemini Advanced,
Claude Pro/Max) do **not** grant third-party/programmatic access — Anthropic's
subscription→Agent-SDK credit was paused on 2026-06-15, and OpenAI/Google offer no
such path. Routing a user's subscription through the app would violate provider
ToS and risk account bans. If Anthropic later revives subscription access, a "Sign
in with Claude" option can be added **behind the same gateway** without touching
the TS orchestration.

### TS — the app (UI + orchestration + tools)

- Chat panel, composer, streamed-token rendering; the editor (Tiptap), cursor,
  selection; settings UI; Tab-suggestion UI.
- The **agent loop**: build messages + tool list → call the Rust gateway → handle
  `tool_use` → dispatch → append results → repeat.
- **All tools execute in TS:**

  | Tool | Notes |
  | --- | --- |
  | `get_selection`, `get_document` | live editor state |
  | `propose_edit(range, newText)` | render diff card, await Accept, then apply + autosave |
  | `insert_at_cursor(text)` | apply to the Tiptap buffer |
  | `search_vault(query)`, `read_file(path)` | via the `fs` plugin (already used in M1) |

  Mutating tools `await` the user's decision inside the loop — natural in TS, no
  cross-process bridge.

## Interface (small and stable)

```
Rust commands (TS → Rust):
  list_keys()                    -> [{ id, label, masked, savedAt }]   // never the raw secret
  set_key(id, rawKey)            -> store / overwrite in Keychain
  delete_key(id)                 -> remove from Keychain
  model_stream(provider, body, ch) -> pick adapter + inject key + scrub + stream over Channel `ch`
  cancel(turnId)

Rust → TS (tauri::ipc::Channel):
  token(delta)                   -> live streamed text
  done(finalMessage) | error(e)
```

The request body (messages, tools, document context) is assembled in TS and is
not secret. Only the `x-api-key` header — added in Rust — is.

## Settings & key management

The settings screen manages **only Writer's own Keychain items**, scoped to the
app's service (`com.shunito.writer`). It must **not** enumerate or read other
apps' Keychain entries — that is invasive and would look malicious in an
open-source app.

- **List (masked):** `list_keys()` returns display metadata only —
  `sk-ant-••••••1234`, a label, a saved date. The raw secret is never sent to JS.
- **Update:** paste a new value → `set_key(id, rawKey)` overwrites the item.
- **Delete:** `delete_key(id)` removes it.
- **No "reveal full key" button.** That is the one action that would pull the
  secret back into the webview and defeat the boundary. Lost a key → paste a new
  one.

**Data model.** Secret in Keychain as `(service: "com.shunito.writer",
account: "<provider-id>")` — `anthropic`, `openai`, `gemini`, `kimi`. The masked
form (last-4) is computed in Rust from the stored key when `list_keys` runs, so no
separate metadata store is needed in v1.

**Crate.** `keyring` (feature `apple-native`) covers get/set/delete per
`(service, account)`. It does not enumerate — fine, since the provider list is a
fixed known set, not a Keychain scan.

**v1 scope.** Four providers: **Anthropic (Claude), OpenAI, Google (Gemini), Kimi
(Moonshot)**. Each row: paste/save key, masked status, delete, and a user-specified
model id. Local LLM (Ollama) and more come later via the OpenAI-compatible adapter.

**Required disclosure copy** (shown on the settings page, verbatim):

> This app uses your own API key to call LLM providers directly from your device.
> Your API key is stored locally in macOS Keychain and is never sent to our
> servers. API usage may incur costs from your selected provider.

## Build staging (do not build the loop first)

1. **Rust gateway** — Keychain (`set_key`/`list_keys`/`delete_key`) +
   `claude_stream` (proxy + scrub), no tools.
2. **TS** — settings UI (key management + disclosure copy); chat panel renders the
   stream; Tab suggestion (one-shot, no tools).
3. **Structured single-edit** — model returns one proposed edit → diff → Accept.
4. **Tools + loop** — add `search_vault` etc. and multi-step orchestration, all in
   TS.

## Current state (Milestone 1)

No AI yet. File loop is pure TS via the `fs` + `dialog` plugins; Rust only
registers plugins. The gateway, key management, and disclosure above are
Milestone 2.
