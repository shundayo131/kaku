// Milestone 2 (in progress) — the AI gateway: Keychain-backed key management
// (keys.rs) and the model completion command (ai.rs). File IO stays in TS via
// the fs + dialog plugins.
mod ai;
mod keys;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            keys::set_key,
            keys::delete_key,
            keys::list_keys,
            ai::model_complete
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
