// Thin wrappers over the Tauri dialog + fs plugins for vault file IO.

import { open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

const MD_FILTER = [{ name: "Markdown", extensions: ["md", "markdown"] }];

/** Open-file picker. Returns the chosen path, or null if cancelled. */
export async function pickFileToOpen(): Promise<string | null> {
  const file = await open({
    directory: false,
    multiple: false,
    filters: MD_FILTER,
  });
  return typeof file === "string" ? file : null;
}

/** Save-file dialog for creating a new doc. Returns the path, or null. */
export async function pickSavePath(defaultPath: string): Promise<string | null> {
  const path = await saveDialog({ defaultPath, filters: MD_FILTER });
  return typeof path === "string" ? path : null;
}

export const readDoc = (path: string): Promise<string> => readTextFile(path);

export const writeDoc = (path: string, content: string): Promise<void> =>
  writeTextFile(path, content);
