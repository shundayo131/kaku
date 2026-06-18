//! Model gateway. Reads the provider key from Keychain (Rust-side only),
//! scrubs the outbound body, calls the provider, returns the completion.
//!
//! Anthropic adapter, non-streaming, with multi-turn `messages`, optional
//! extended thinking, and an optional server-side web-search tool. OpenAI-
//! compatible (OpenAI + Kimi) and Google adapters, plus streaming, come next.
//! See docs/ARCHITECTURE.md.

use serde::Deserialize;

const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";

/// Tokens reserved for extended thinking, added on top of the caller's desired
/// output budget (Anthropic requires `max_tokens` > the thinking budget).
const THINKING_BUDGET: u32 = 1024;

/// One turn of conversation. `role` is "user" or "assistant".
#[derive(Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// A single non-streaming completion over a multi-turn message list.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn model_complete(
    provider: String,
    model: String,
    system: Option<String>,
    messages: Vec<ChatMessage>,
    max_tokens: Option<u32>,
    thinking: Option<bool>,
    web_search: Option<bool>,
    document_context: Option<String>,
) -> Result<String, String> {
    let thinking = thinking.unwrap_or(false);
    let web_search = web_search.unwrap_or(false);
    eprintln!(
        "[kaku] model_complete: provider={provider} model={model} turns={} thinking={thinking} web_search={web_search} doc_ctx={}",
        messages.len(),
        document_context.is_some()
    );
    let key = match crate::keys::get_key(&provider) {
        Ok(k) => k,
        Err(e) => {
            eprintln!("[kaku] key error: {e}");
            return Err(e);
        }
    };
    let system = system.map(|s| scrub(&s));
    // Scrub every turn's content (defense in depth — same as the system prompt).
    let messages: Vec<ChatMessage> = messages
        .into_iter()
        .map(|m| ChatMessage {
            role: m.role,
            content: scrub(&m.content),
        })
        .collect();
    let document_context = document_context.map(|d| scrub(&d));
    let max_tokens = max_tokens.unwrap_or(512);

    let result = match provider.as_str() {
        "anthropic" => {
            let body = build_anthropic_body(
                &model,
                system.as_deref(),
                &messages,
                max_tokens,
                thinking,
                web_search,
                document_context.as_deref(),
            );
            anthropic_complete(&key, body).await
        }
        other => Err(format!("Provider not yet supported: {other}")),
    };
    match &result {
        Ok(t) => eprintln!("[kaku] completion ok ({} chars)", t.chars().count()),
        Err(e) => eprintln!("[kaku] completion error: {e}"),
    }
    result
}

/// Build the Anthropic request body (pure — no IO, so it's unit-testable).
///
/// When `document_context` is present it becomes a separate, cache-controlled
/// text block at the head of the first user turn. Splitting it out (rather than
/// concatenating it into the instruction) keeps it byte-stable across refine
/// turns and repeat edits, so prompt caching can reuse it.
#[allow(clippy::too_many_arguments)]
fn build_anthropic_body(
    model: &str,
    system: Option<&str>,
    messages: &[ChatMessage],
    max_tokens: u32,
    thinking: bool,
    web_search: bool,
    document_context: Option<&str>,
) -> serde_json::Value {
    let msgs: Vec<serde_json::Value> = messages
        .iter()
        .enumerate()
        .map(|(i, m)| {
            if i == 0 {
                if let Some(doc) = document_context {
                    return serde_json::json!({
                        "role": m.role,
                        "content": [
                            {
                                "type": "text",
                                "text": doc,
                                "cache_control": { "type": "ephemeral" }
                            },
                            { "type": "text", "text": m.content }
                        ]
                    });
                }
            }
            serde_json::json!({ "role": m.role, "content": m.content })
        })
        .collect();

    // Extended thinking consumes part of the response budget, so reserve extra
    // on top of the caller's desired output size.
    let body_max_tokens = if thinking {
        max_tokens + THINKING_BUDGET
    } else {
        max_tokens
    };

    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": body_max_tokens,
        "messages": msgs,
    });
    if let Some(s) = system {
        body["system"] = serde_json::Value::String(s.to_string());
    }
    if thinking {
        body["thinking"] = serde_json::json!({
            "type": "enabled",
            "budget_tokens": THINKING_BUDGET,
        });
    }
    if web_search {
        body["tools"] = serde_json::json!([
            { "type": "web_search_20250305", "name": "web_search", "max_uses": 5 }
        ]);
    }
    body
}

async fn anthropic_complete(key: &str, body: serde_json::Value) -> Result<String, String> {
    let resp = reqwest::Client::new()
        .post(ANTHROPIC_URL)
        .header("x-api-key", key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = resp.status();
    let val: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        let msg = val["error"]["message"]
            .as_str()
            .unwrap_or("request failed");
        return Err(format!("Anthropic {}: {}", status.as_u16(), msg));
    }

    // Concatenate the text blocks. Thinking, tool-use, and web-search-result
    // blocks carry no "text" field and are naturally skipped.
    let text = val["content"]
        .as_array()
        .map(|blocks| {
            blocks
                .iter()
                .filter_map(|b| b["text"].as_str())
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default();

    Ok(text)
}

/// Redact obvious API-key patterns from outgoing text (defense in depth).
/// Catches user-introduced keys (pasted into the doc, read from a vault file),
/// not just the app's managed key. See docs/SECURITY.md.
fn scrub(input: &str) -> String {
    let mut s = input.to_string();
    for prefix in ["sk-ant-", "sk-"] {
        s = redact_prefixed(&s, prefix);
    }
    s
}

fn redact_prefixed(input: &str, prefix: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut rest = input;
    while let Some(pos) = rest.find(prefix) {
        out.push_str(&rest[..pos]);
        let after = &rest[pos + prefix.len()..];
        let key_chars = after
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
            .count();
        if key_chars >= 16 {
            out.push_str("[redacted-key]");
            let byte_len: usize = after.chars().take(key_chars).map(|c| c.len_utf8()).sum();
            rest = &after[byte_len..];
        } else {
            out.push_str(prefix);
            rest = after;
        }
    }
    out.push_str(rest);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_anthropic_key() {
        let input = "my key is sk-ant-api03-abcdefabcdefabcdefabcdef done";
        let out = scrub(input);
        assert!(out.contains("[redacted-key]"));
        assert!(!out.contains("abcdefabcdef"));
        assert!(out.starts_with("my key is "));
        assert!(out.ends_with(" done"));
    }

    #[test]
    fn redacts_generic_sk_key() {
        assert_eq!(scrub("sk-proj-0123456789abcdef0123456789"), "[redacted-key]");
    }

    #[test]
    fn leaves_ordinary_text_untouched() {
        // "task-list" and "risk-free" contain "sk-" but no long key follows.
        let input = "The task-list and risk-free plan are fine.";
        assert_eq!(scrub(input), input);
    }

    #[test]
    fn empty_input() {
        assert_eq!(scrub(""), "");
    }

    fn user(content: &str) -> ChatMessage {
        ChatMessage {
            role: "user".into(),
            content: content.into(),
        }
    }

    #[test]
    fn doc_context_becomes_a_cached_first_block() {
        let msgs = [user("Instruction: shorten")];
        let body = build_anthropic_body("m", None, &msgs, 1024, false, false, Some("THE DOC"));
        let first = &body["messages"][0]["content"];
        assert_eq!(first[0]["text"], "THE DOC");
        assert_eq!(first[0]["cache_control"]["type"], "ephemeral");
        assert_eq!(first[1]["text"], "Instruction: shorten");
    }

    #[test]
    fn no_doc_context_keeps_plain_string_content() {
        let msgs = [user("hello")];
        let body = build_anthropic_body("m", None, &msgs, 1024, false, false, None);
        assert_eq!(body["messages"][0]["content"], "hello");
        assert!(body.get("thinking").is_none());
        assert!(body.get("tools").is_none());
    }

    #[test]
    fn thinking_enables_block_and_reserves_budget() {
        let msgs = [user("x")];
        let body = build_anthropic_body("m", None, &msgs, 1024, true, false, None);
        assert_eq!(body["thinking"]["type"], "enabled");
        assert_eq!(body["thinking"]["budget_tokens"], THINKING_BUDGET);
        assert_eq!(body["max_tokens"], 1024 + THINKING_BUDGET);
    }

    #[test]
    fn web_search_adds_the_tool() {
        let msgs = [user("x")];
        let body = build_anthropic_body("m", None, &msgs, 1024, false, true, None);
        assert_eq!(body["tools"][0]["name"], "web_search");
    }
}
