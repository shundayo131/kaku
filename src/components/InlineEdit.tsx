import { useCallback, useEffect, useRef, useState } from "react";

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
  requestEdit: (instruction: string, original: string) => Promise<string>;
  onAccept: (result: string) => void;
  onClose: () => void;
};

export function InlineEdit({ top, original, requestEdit, onAccept, onClose }: Props) {
  const [instruction, setInstruction] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const lastInstruction = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const run = useCallback(
    async (instr: string) => {
      const text = instr.trim();
      if (!text) return;
      lastInstruction.current = text;
      setPhase("loading");
      setError(null);
      try {
        const r = await requestEdit(text, original);
        if (!r) {
          setError("The model returned nothing.");
          setPhase("input");
          return;
        }
        setResult(r);
        setPhase("preview");
      } catch (e) {
        setError(String(e));
        setPhase("input");
      }
    },
    [requestEdit, original],
  );

  return (
    <div
      className="inline-edit"
      style={{ top }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      {phase !== "preview" ? (
        <>
          <div className="ie-quick">
            {QUICK_ACTIONS.map((q) => (
              <button
                key={q.label}
                className="ie-chip"
                disabled={phase === "loading"}
                onClick={() => void run(q.instruction)}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="ie-input-row">
            <input
              ref={inputRef}
              value={instruction}
              disabled={phase === "loading"}
              placeholder={phase === "loading" ? "Editing…" : "Describe the edit…"}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void run(instruction);
                }
              }}
            />
            <button
              className="ie-send"
              disabled={phase === "loading" || !instruction.trim()}
              onClick={() => void run(instruction)}
              aria-label="Run edit"
            >
              {phase === "loading" ? "…" : "↑"}
            </button>
            <button className="ie-x" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          {error && <div className="ie-error">{error}</div>}
        </>
      ) : (
        <>
          <div className="ie-preview">
            <div className="ie-old">{original}</div>
            <div className="ie-new">{result}</div>
          </div>
          <div className="ie-controls">
            <button className="ie-accept" onClick={() => onAccept(result)}>
              ✓ Accept
            </button>
            <button
              className="ie-btn"
              onClick={() => void run(lastInstruction.current)}
              title="Retry"
            >
              ↻ Retry
            </button>
            <button className="ie-btn" onClick={onClose} title="Discard">
              ✕ Discard
            </button>
          </div>
        </>
      )}
    </div>
  );
}
