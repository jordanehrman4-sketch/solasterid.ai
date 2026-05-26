import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Props = {
  tempseed: string;
  round: number;
  onApply: (seed: string) => void;
};

export function SeedEditor({ tempseed, round, onApply }: Props) {
  const [draft, setDraft] = useState(tempseed);
  const [applied, setApplied] = useState(false);

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

  return (
    <section className="glass-panel p-4" style={{ borderColor: "rgba(45,212,191,0.2)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-teal-200 text-glow-teal tracking-wide">LIVE SEED · tempseed</h2>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-mono"
          style={{ background: isInjectionRound ? "rgba(45,212,191,0.2)" : "rgba(100,116,139,0.2)",
                   color: isInjectionRound ? "#2dd4bf" : "#94a3b8", border: `1px solid ${isInjectionRound ? "rgba(45,212,191,0.4)" : "rgba(100,116,139,0.3)"}` }}>
          {isInjectionRound ? "tide incoming" : `tide in ${roundsUntilInjection}r`}
        </span>
      </div>

      <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
        The organism keeps swimming while you edit. Every 5 rounds, the current tempseed is injected as a recurrent growth signal.
      </p>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
        className="mt-3 w-full resize-y rounded-xl border border-teal-200/10 bg-slate-950/80 px-3 py-2 text-xs text-slate-200 outline-none transition-all focus:border-teal-400/40 focus:shadow-[0_0_10px_rgba(45,212,191,0.15)]"
        placeholder="Describe the kind of Solasterid you want to grow…"
        style={{ fontFamily: "inherit", minHeight: 80 }}
      />

      <div className="mt-3 flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleApply}
          className="rounded-xl px-4 py-2 text-sm font-bold text-slate-950 transition-all"
          style={{ background: applied ? "linear-gradient(135deg, #4ade80, #0d9488)" : "linear-gradient(135deg, #2dd4bf, #0891b2)" }}
        >
          {applied ? "✓ Applied" : "Apply tempseed"}
        </motion.button>

        <button
          onClick={() => setDraft(tempseed)}
          className="rounded-xl px-3 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Reset
        </button>
      </div>

      {isInjectionRound && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 rounded-xl border border-teal-400/30 bg-teal-950/30 px-3 py-2 text-[11px] text-teal-300"
        >
          Next round is a full seed injection tide. The current tempseed will be injected as seed=&lt;tempseed&gt;.
        </motion.div>
      )}
    </section>
  );
}
