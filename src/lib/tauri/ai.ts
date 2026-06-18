// Model gateway command (Rust-backed). The raw API key never crosses this
// boundary — Rust reads it from Keychain and adds the auth header itself.

import { invoke } from "@tauri-apps/api/core";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type CompleteArgs = {
  provider: string;
  model: string;
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  /** Extended thinking (Anthropic). Off unless set. */
  thinking?: boolean;
  /** Server-side web search tool (Anthropic). Off unless set — opt-in, since
   * queries leave the device. */
  webSearch?: boolean;
};

export const modelComplete = (args: CompleteArgs): Promise<string> =>
  invoke<string>("model_complete", args);
