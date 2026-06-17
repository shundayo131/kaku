// Measure caret/selection geometry inside a <textarea> by mirroring its layout
// in a hidden div. Used to anchor the inline-edit panel and draw a selection
// highlight that survives the textarea losing focus.

import type { Rect } from "../types";

const STYLE_PROPS = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "wordSpacing",
] as const;

export type Coords = { left: number; top: number; lineHeight: number };

function makeMirror(ta: HTMLTextAreaElement): {
  div: HTMLDivElement;
  lineHeight: number;
} {
  const cs = getComputedStyle(ta);
  const div = document.createElement("div");
  const s = div.style;
  s.position = "absolute";
  s.visibility = "hidden";
  s.top = "0";
  s.left = "0";
  s.whiteSpace = "pre-wrap";
  s.overflowWrap = "break-word";
  s.wordBreak = "break-word";
  for (const p of STYLE_PROPS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as any)[p] = (cs as any)[p];
  }
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
  return { div, lineHeight };
}

/** Caret coordinates at `pos`, relative to the textarea's offset parent. */
export function caretCoords(ta: HTMLTextAreaElement, pos: number): Coords {
  const parent = ta.parentElement;
  const { div, lineHeight } = makeMirror(ta);
  if (!parent) return { left: 56, top: 0, lineHeight };
  div.textContent = ta.value.slice(0, pos);
  const marker = document.createElement("span");
  marker.textContent = ta.value.slice(pos) || ".";
  div.appendChild(marker);
  parent.appendChild(div);
  const coords = { left: marker.offsetLeft, top: marker.offsetTop, lineHeight };
  parent.removeChild(div);
  return coords;
}

/** Rectangles (one per visual line) covering [start, end), relative to the
 * textarea's offset parent. */
export function selectionRects(
  ta: HTMLTextAreaElement,
  start: number,
  end: number,
): Rect[] {
  const parent = ta.parentElement;
  if (!parent) return [];
  const { div } = makeMirror(ta);
  div.appendChild(document.createTextNode(ta.value.slice(0, start)));
  const span = document.createElement("span");
  span.textContent = ta.value.slice(start, end) || " ";
  div.appendChild(span);
  div.appendChild(document.createTextNode(ta.value.slice(end)));
  parent.appendChild(div);
  const pr = parent.getBoundingClientRect();
  const rects = Array.from(span.getClientRects()).map((r) => ({
    left: r.left - pr.left,
    top: r.top - pr.top,
    width: r.width,
    height: r.height,
  }));
  parent.removeChild(div);
  return rects;
}
