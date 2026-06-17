// Model gateway command (Rust-backed). The raw API key never crosses this
// boundary — Rust reads it from Keychain and adds the auth header itself.

import { invoke } from "@tauri-apps/api/core";

export type CompleteArgs = {
  provider: string;
  model: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
};

export const modelComplete = (args: CompleteArgs): Promise<string> =>
  invoke<string>("model_complete", args);
