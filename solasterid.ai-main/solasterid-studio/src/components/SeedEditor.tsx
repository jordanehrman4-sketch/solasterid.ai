import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CSSProperties } from "react";

type Props = {
  tempseed: string;
  round: number;
  onApply: (seed: string) => void;
};

/**
 * Quick-add steering nudges. Clicking one appends the phrase to the draft so
 * the user can either apply as-is or massage the wording first.
 */
type SteerNudge = { id: string; label: string; phrase: string; tone: string };

const STEER_LIST: SteerNudge[] = [
  {
    id: "precision",
    label: "precision",
    tone: "#8FFFE6",
    phrase:
      "Prioritize precision: cite exact numbers, name specific methods, and avoid vague claims.",
  },
  {
    id: "web",
    label: "real data",
    tone: "#B0D8E8",
    phrase:
      "When real-world facts matter, do web searches and cite sources instead of guessing.",
  },
  {
    id: "creative",
    label: "creativity",
    tone: "#C8B0E8",
    phrase:
      "Stay weird and high-variance: propose unusual angles before settling on the safe one.",
  },
  {
    id: "prune",
    label: "prune",
    tone: "#FF9A98",
    phrase:
      "Focus on pruning: retire arms with overlapping lenses and consolidate committees.",
  },
  {
    id: "grow",
    label: "grow",
    tone: "#A8E6B2",
    phrase:
      "Focus on growth: add specialist arms whenever a real gap appears, even if it costs bloat.",
  },
];

export function SeedEditor({ tempseed, round, onApply }: Props) {
  const [draft, setDraft] = useState(tempseed);
  const [applied, setApplied] = useState(false);
  const [showHints, setShowHints] = useState(true);

  useEffect(() => {
    setDraft(tempseed);
  }, [tempseed]);

  const nextRound = round + 1;
  const isInjectionRound = nextRound % 5 === 0 || nextRound === 1;
  const roundsUntilInjection = isInjectionRound ? 0 : 5 - (nextRound % 5);

  function handleApply() {
    onApply(draft);
    setApplied(true);
    setTimeout(() => setApplied(false), 1800);
  }

  function appendNudge(phrase: string) {
    setDraft((prev) => {
      const trimmed = prev.trim();
      if (trimmed.includes(phrase)) return prev;
      const sep = trimmed && !trimmed.endsWith(".") && !trimmed.endsWith("\n") ? ". " : trimmed ? " " : "";
      return trimmed + sep + phrase;
    });
  }

  return (
    <section className="glass-panel" style={{ padding: 16 }}>
      <div className="flex items-center justify-between">
        <div className="eyebrow">Live Seed · tempseed</div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10.5px] font-display"
          style={{
            background: isInjectionRound ? "rgba(10,33,56,0.12)" : "rgba(255,255,255,0.04)",
            color: isInjectionRound ? "var(--foam)" : "var(--text-mute)",
            border: `1px solid ${
              isInjectionRound ? "rgba(10,33,56,0.28)" : "rgba(10,33,56,0.08)"
            }`,
            letterSpacing: "0.08em",
          }}
        >
          {isInjectionRound ? "tide incoming" : `tide in ${roundsUntilInjection}r`}
        </span>
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
        The organism keeps swimming while you edit. Every 5 rounds, the current tempseed
        is injected as a recurrent growth signal.
      </p>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
        placeholder="Describe the kind of Solasterid you want to grow…"
        className="mt-3 w-full resize-y px-3 py-2.5 text-[12px] outline-none transition-all"
        style={{
          background: "rgba(255,255,255,0.78)",
          border: "1px solid rgba(10,33,56,0.12)",
          borderRadius: 14,
          color: "var(--text)",
          fontFamily: "var(--font-sans)",
          lineHeight: 1.55,
          minHeight: 90,
        }}
      />

      {/* Steering hints — the creature only does what tempseed asks. */}
      <div
        className="mt-2.5 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.5)",
          border: "1px solid rgba(10,33,56,0.08)",
        }}
      >
        <button
          type="button"
          onClick={() => setShowHints((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2"
          style={{ color: "var(--text-soft)" }}
        >
          <span className="eyebrow">Steering hints</span>
          <span className="text-[10.5px]" style={{ color: "var(--text-mute)" }}>
            {showHints ? "▴ hide" : "▾ show"}
          </span>
        </button>
        <AnimatePresence initial={false}>
          {showHints && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3">
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--text-soft)", textWrap: "pretty" } as CSSProperties}
                >
                  The creature only does what the seed asks for. If you want
                  precision, ask for it. If you want real data via web search,
                  ask for it. If you want it to be creative, ask. If you want
                  it to prune itself, ask. If you want it to focus on growth,
                  ask. Tap a hint to append a starting phrase — you can edit
                  the wording before applying.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {STEER_LIST.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => appendNudge(n.phrase)}
                      className="rounded-full px-2.5 py-1 text-[10.5px] font-display transition-colors"
                      style={{
                        background: n.tone + "12",
                        color: n.tone,
                        border: `1px solid ${n.tone}3A`,
                        letterSpacing: "0.06em",
                      }}
                      title={n.phrase}
                    >
                      + {n.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ y: 1 }}
          onClick={handleApply}
          className="btn"
          style={{
            background: applied
              ? "linear-gradient(135deg, #A8E6B2, #64F5E6)"
              : "linear-gradient(135deg, #64F5E6, #8FFFE6)",
            color: "#03111F",
            border: "1px solid rgba(143,255,230,0.45)",
            fontWeight: 600,
          }}
        >
          {applied ? "✓ Applied" : "Apply tempseed"}
        </motion.button>
        <button
          onClick={() => setDraft(tempseed)}
          className="btn btn-ghost"
        >
          reset
        </button>
      </div>

      {isInjectionRound && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 rounded-2xl px-3 py-2 text-[11.5px]"
          style={{
            background: "rgba(10,33,56,0.06)",
            border: "1px solid rgba(143,255,230,0.25)",
            color: "var(--foam)",
          }}
        >
          Next round is a full seed injection tide. The current tempseed will be
          injected as <span className="mono">seed=&lt;tempseed&gt;</span>.
        </motion.div>
      )}
    </section>
  );
}
