// Keychain API-key management commands (Rust-backed).

import { invoke } from "@tauri-apps/api/core";
import type { KeyInfo } from "../../types";

export const listKeys = (): Promise<KeyInfo[]> => invoke<KeyInfo[]>("list_keys");

export const setKey = (provider: string, key: string): Promise<void> =>
  invoke("set_key", { provider, key });

export const deleteKey = (provider: string): Promise<void> =>
  invoke("delete_key", { provider });
