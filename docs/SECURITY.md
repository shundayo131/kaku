# Security

Security model and pre-release gate for Kaku — an **open-source, distributed**
macOS app where each user supplies **their own** API key. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for the TS/Rust boundary this builds on.

## Threat model

- Local desktop app; each user's key stays on their own machine and is used only
  by them. This is **not** the web "shared developer key" problem.
- Because we distribute to others, we are responsible for handling **other
  people's paid keys** correctly. A leak is our software's fault and costs the
  user money.
- The webview renders **untrusted content** (imported PDF / DOCX / URL, plus
  AI-generated output), so it is a real injection surface.

## Key-handling rules (non-negotiable)

1. **Stored only in the macOS Keychain**, via native code (Rust `keyring`).
   Never in `localStorage`, a config file, `.env`, or any plaintext on disk.
2. **Never enters frontend JS.** The webview never holds the raw key. Rust reads
   it from Keychain and adds the `x-api-key` header itself.
3. **Single egress.** The Rust gateway is the only place the key is used. It is
   the one outbound path to Anthropic and **never returns the raw key** to the
   frontend.
4. **Never logged.** No prompts, request bodies, headers, or keys in logs,
   telemetry, crash reports, or analytics.

Because the prompt-building code (TS) never possesses the key, the app **cannot
accidentally embed the key into a prompt** — the value simply isn't in scope on
that side.

## Outbound scrub (defense in depth)

The key-handling rules above stop the *app* from leaking the key. They do **not**
stop a key that a **user** introduces into content — e.g. pasting it into a
document or the chat box, or a vault file containing a key that a tool
(`read_file` / `search_vault`) pulls into context. That content would otherwise
be sent to the model as prompt text.

Since the Rust gateway is the **single egress**, it is the guaranteed chokepoint
to catch this. Before sending any request body to Anthropic, the gateway
**scrubs API-key-like patterns**:

- Scan the outgoing request body (messages + tool inputs) for secret patterns —
  at minimum Anthropic keys (`sk-ant-[A-Za-z0-9_-]{20,}`); extend to common
  provider/token shapes (`sk-...`, bearer tokens) as useful.
- **Redact** matches (e.g. replace with `[redacted-key]`) rather than blocking
  the request.
- **Do not log the matched value.** Optionally surface a one-line UI warning
  ("a possible API key was removed from your message before sending").
- Implemented in Rust so every send passes through it regardless of any frontend
  bug.

This protects against user-introduced keys without weakening the primary rule
that the *app's* managed key never reaches the prompt at all.

## Pre-release checklist

Necessary before distributing builds:

- [ ] **Code-sign + notarize** the app (Gatekeeper requirement; also strengthens
      the Keychain ACL so items bind to the signed app).
- [ ] **Restrictive CSP** — `src-tauri/tauri.conf.json` currently has
      `"csp": null`. Lock it down to shrink the XSS surface.
- [ ] **Least-privilege capabilities** — trim unused `fs` permissions and scope
      file access to the selected vault rather than all of `$HOME` where
      feasible.
- [ ] **Sanitize untrusted rendering** — Markdown / embedded HTML / AI output
      shown in the webview.
- [ ] **Single egress + scrub** — Rust gateway is the only key-using path, never
      returns the raw key, and runs the outbound scrub above.
- [ ] **No committed secrets** — keys, signing/notarization credentials, local
      vault contents stay out of the repo.
- [ ] **Dependency review** — audit npm and Cargo dependencies before release.

## Current status (Milestone 1)

No key handling implemented yet — there is no AI path. The Keychain storage,
single-egress gateway, and outbound scrub land in Milestone 2 (see
[ARCHITECTURE.md](./ARCHITECTURE.md)).
