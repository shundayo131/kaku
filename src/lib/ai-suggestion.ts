// A Tiptap extension that renders a pending AI rewrite *inline* in the document
// without mutating it: the original selection is struck through and the proposed
// replacement is shown right after it, with inline ✓/✕ controls. The document is
// only changed when the user accepts — so autosave never persists an un-accepted
// suggestion and undo stays clean.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type AiSuggestionData = { from: number; to: number; text: string };

export type AiSuggestionHandlers = {
  onAccept: () => void;
  onReject: () => void;
};

export interface AiSuggestionOptions {
  /** Resolved lazily so the React side can swap handlers without re-creating
   * the editor. */
  getHandlers: () => AiSuggestionHandlers;
}

export const aiSuggestionKey = new PluginKey<AiSuggestionData | null>(
  "aiSuggestion",
);

export const AiSuggestion = Extension.create<AiSuggestionOptions>({
  name: "aiSuggestion",

  addOptions() {
    return {
      getHandlers: () => ({ onAccept: () => {}, onReject: () => {} }),
    };
  },

  addProseMirrorPlugins() {
    const getHandlers = () => this.options.getHandlers();
    return [
      new Plugin<AiSuggestionData | null>({
        key: aiSuggestionKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(aiSuggestionKey);
            if (meta !== undefined) return meta as AiSuggestionData | null;
            // Keep the range valid if the doc shifts underneath it.
            if (value && tr.docChanged) {
              return {
                ...value,
                from: tr.mapping.map(value.from),
                to: tr.mapping.map(value.to),
              };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            const data = aiSuggestionKey.getState(state);
            if (!data) return null;
            const decos: Decoration[] = [];
            if (data.to > data.from) {
              decos.push(
                Decoration.inline(data.from, data.to, { class: "ai-sug-old" }),
              );
            }
            decos.push(
              Decoration.widget(
                data.to,
                () => renderSuggestion(data.text, getHandlers()),
                { side: 1, ignoreSelection: true, key: `ai-sug-${data.text}` },
              ),
            );
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

function renderSuggestion(
  text: string,
  handlers: AiSuggestionHandlers,
): HTMLElement {
  // A block holding the proposed "new" text (green) with a Keep/Undo bar pinned
  // to its bottom-right. The original selection is tinted red by the inline
  // decoration above, giving an old→new diff in the document flow.
  const wrap = document.createElement("span");
  wrap.className = "ai-sug";
  wrap.contentEditable = "false";

  const ins = document.createElement("span");
  ins.className = "ai-sug-new";
  ins.textContent = text;

  const bar = document.createElement("span");
  bar.className = "ai-sug-bar";
  bar.append(
    suggestionButton("Undo ⌘N", "ai-sug-undo", handlers.onReject),
    suggestionButton("Keep ⌘Y", "ai-sug-keep", handlers.onAccept),
  );

  wrap.append(ins, bar);
  return wrap;
}

function suggestionButton(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `ai-sug-btn ${className}`;
  b.textContent = label;
  // Use mousedown + preventDefault so the press fires before the editor's
  // selection logic and never bubbles to the surface's "close panel" handler.
  b.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return b;
}
