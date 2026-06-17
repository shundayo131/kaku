//! Model gateway. Reads the provider key from Keychain (Rust-side only),
//! scrubs the outbound body, calls the provider, returns the completion.
//!
//! Milestone 2: Anthropic adapter, non-streaming. OpenAI-compatible (OpenAI +
//! Kimi) and Google adapters, plus streaming, come next. See docs/ARCHITECTURE.md.

const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";

/// A single non-streaming completion.
#[tauri::command]
pub async fn model_complete(
    provider: String,
    model: String,
    system: Option<String>,
    prompt: String,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    eprintln!("[writer] model_complete: provider={provider} model={model}");
    let key = match crate::keys::get_key(&provider) {
        Ok(k) => k,
        Err(e) => {
            eprintln!("[writer] key error: {e}");
            return Err(e);
        }
    };
    let system = system.map(|s| scrub(&s));
    let prompt = scrub(&prompt);
    let max_tokens = max_tokens.unwrap_or(512);

    let result = match provider.as_str() {
        "anthropic" => anthropic_complete(&key, &model, system.as_deref(), &prompt, max_tokens).await,
        other => Err(format!("Provider not yet supported: {other}")),
    };
    match &result {
        Ok(t) => eprintln!("[writer] completion ok ({} chars)", t.chars().count()),
        Err(e) => eprintln!("[writer] completion error: {e}"),
    }
    result
}

async fn anthropic_complete(
    key: &str,
    model: &str,
    system: Option<&str>,
    prompt: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": [ { "role": "user", "content": prompt } ],
    });
    if let Some(s) = system {
        body["system"] = serde_json::Value::String(s.to_string());
    }

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

    let text = val["content"]
        .as_array()
        .and_then(|blocks| {
            blocks
                .iter()
                .filter_map(|b| b["text"].as_str())
                .collect::<Vec<_>>()
                .join("")
                .into()
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
