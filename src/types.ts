export type Doc = {
  name: string; // file name, e.g. "Local-first AI writing.md"
  path: string; // absolute path
};

export type EditState = {
  start: number;
  end: number;
  original: string;
  top: number; // px from the top of the editor surface
};

export type Rect = { left: number; top: number; width: number; height: number };

export type KeyInfo = {
  id: string;
  label: string;
  present: boolean;
  masked: string;
};

export type ActiveModel = { provider: string; model: string };
