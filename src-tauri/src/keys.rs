//! API key storage in the macOS Keychain.
//!
//! Each provider's key is stored as a Keychain item under the app's service
//! name. The raw key is never returned to the frontend — `list_keys` returns
//! only a masked form (last 4 chars). See docs/ARCHITECTURE.md and SECURITY.md.

use keyring::{Entry, Error as KeyringError};
use serde::Serialize;

const SERVICE: &str = "com.shunito.kaku";

/// Fixed, known provider set. (id, display label)
const PROVIDERS: &[(&str, &str)] = &[
    ("anthropic", "Anthropic (Claude)"),
    ("openai", "OpenAI"),
    ("gemini", "Google Gemini"),
    ("kimi", "Kimi (Moonshot)"),
];

#[derive(Serialize)]
pub struct KeyInfo {
    id: String,
    label: String,
    present: bool,
    /// e.g. "••••wxyz" — never the full secret.
    masked: String,
}

fn is_known(provider: &str) -> bool {
    PROVIDERS.iter().any(|(id, _)| *id == provider)
}

fn entry(provider: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, provider).map_err(|e| e.to_string())
}

fn mask(key: &str) -> String {
    let n = key.chars().count();
    if n <= 4 {
        "••••".to_string()
    } else {
        let last4: String = key.chars().skip(n - 4).collect();
        format!("••••{last4}")
    }
}

/// Read a provider's raw key for internal use by the AI gateway.
/// NOT a Tauri command — the raw key must never cross to the frontend.
pub fn get_key(provider: &str) -> Result<String, String> {
    if !is_known(provider) {
        return Err(format!("Unknown provider: {provider}"));
    }
    match entry(provider)?.get_password() {
        Ok(k) => Ok(k),
        Err(KeyringError::NoEntry) => Err(format!("No API key saved for {provider}.")),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn set_key(provider: String, key: String) -> Result<(), String> {
    if !is_known(&provider) {
        return Err(format!("Unknown provider: {provider}"));
    }
    let key = key.trim();
    if key.is_empty() {
        return Err("Key is empty".into());
    }
    entry(&provider)?
        .set_password(key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_key(provider: String) -> Result<(), String> {
    if !is_known(&provider) {
        return Err(format!("Unknown provider: {provider}"));
    }
    match entry(&provider)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(KeyringError::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn list_keys() -> Result<Vec<KeyInfo>, String> {
    let mut out = Vec::with_capacity(PROVIDERS.len());
    for (id, label) in PROVIDERS {
        let (present, masked) = match entry(id)?.get_password() {
            Ok(k) => (true, mask(&k)),
            Err(KeyringError::NoEntry) => (false, String::new()),
            Err(e) => return Err(e.to_string()),
        };
        out.push(KeyInfo {
            id: (*id).to_string(),
            label: (*label).to_string(),
            present,
            masked,
        });
    }
    Ok(out)
}
