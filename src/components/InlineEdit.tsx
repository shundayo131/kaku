import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ChatMessage } from "../lib/tauri/ai";

const QUICK_ACTIONS = [
  { label: "Fix grammar", instruction: "Fix grammar and spelling. Preserve meaning and tone." },
  { label: "Shorten", instruction: "Make this more concise without losing key meaning." },
  { label: "Lengthen", instruction: "Expand this with more detail, keeping the same tone." },
  { label: "Improve", instruction: "Improve the clarity and flow." },
];

type Phase = "input" | "loading" | "preview";

type Props = {
  top: number;
  original: string;
  autoFocus: boolean;
  /** Builds the opening user turn (instruction + selection + doc context). */
  buildPrompt: (instruction: string, original: string) => string;
  /** Runs a conversation and returns the trimmed result text. */
  run: (messages: ChatMessage[]) => Promise<string>;
  /** Show the latest draft inline in the editor (accept/reject happen there). */
  onDraft: (text: string) => void;
  onClose: () => void;
};

export function InlineEdit({
  top,
  original,
  autoFocus,
  buildPrompt,
  run,
  onDraft,
  onClose,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The running conversation (user/assistant turns). Empty until the first run.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Only steal focus from the editor when explicitly invoked (⌘K), so a
    // mouse selection leaves the editor editable (Delete/typing still work).
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Grow the active textarea with its content, up to the CSS max-height.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [instruction, phase]);

  // Submit the first instruction, or — once a draft exists — a refinement turn
  // on top of the current draft (real multi-turn conversation).
  const submit = useCallback(
    async (instr: string) => {
      const text = instr.trim();
      if (!text) return;
      const fallback: Phase = messages.length ? "preview" : "input";
      const convo: ChatMessage[] = messages.length
        ? [...messages, { role: "user", content: text }]
        : [{ role: "user", content: buildPrompt(text, original) }];
      setPhase("loading");
      setError(null);
      try {
        const r = await run(convo);
        if (!r) {
          setError("The model returned nothing.");
          setPhase(fallback);
          return;
        }
        setMessages([...convo, { role: "assistant", content: r }]);
        setResult(r);
        setInstruction("");
        setPhase("preview");
        onDraft(r);
      } catch (e) {
        setError(String(e));
        setPhase(fallback);
      }
    },
    [messages, buildPrompt, original, run, onDraft],
  );

  // Re-roll the latest draft: resend the conversation up to the last user turn.
  const retry = useCallback(async () => {
    if (!messages.length) return;
    const convo = messages.slice(0, -1); // drop the trailing assistant draft
    setPhase("loading");
    setError(null);
    try {
      const r = await run(convo);
      setMessages([...convo, { role: "assistant", content: r }]);
      setResult(r);
      setPhase("preview");
      onDraft(r);
    } catch (e) {
      setError(String(e));
      setPhase("preview");
    }
  }, [messages, run, onDraft]);

  const loading = phase === "loading";
  // Layout follows whether a draft exists, not the transient loading state, so
  // the preview stays visible while a refinement is in flight.
  const hasDraft = result !== "";

  return (
    <div
      className="inline-edit"
      style={{ top }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      {hasDraft && (
        <div className="ie-draft-hint">
          Review the change in the document — accept ✓ or reject ✕ inline, or
          ask for another change below.
        </div>
      )}

      {!hasDraft && (
        <div className="ie-quick">
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q.label}
              className="ie-chip"
              disabled={loading}
              onClick={() => void submit(q.instruction)}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      <div className="ie-input-row">
        <textarea
          ref={inputRef}
          className="ie-textarea"
          rows={1}
          value={instruction}
          disabled={loading}
          placeholder={
            loading
              ? "Editing…"
              : hasDraft
                ? "Ask for a change…"
                : "Describe the edit…"
          }
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            // Enter submits; Shift+Enter inserts a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit(instruction);
            }
          }}
        />
        <button
          className="ie-send"
          disabled={loading || !instruction.trim()}
          onClick={() => void submit(instruction)}
          aria-label={hasDraft ? "Refine" : "Run edit"}
        >
          {loading ? "…" : "↑"}
        </button>
        <button className="ie-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {error && <div className="ie-error">{error}</div>}

      {hasDraft && !loading && (
        <div className="ie-controls">
          <button className="ie-btn" onClick={() => void retry()} title="Retry">
            ↻ Retry
          </button>
        </div>
      )}
    </div>
  );
}
