import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  createInitialSolasteridState,
  applyGrowthResult,
  applyUserSeedUpdate,
  type SolasteridState,
} from "../lib/solasteridState";
import { buildGrowthPrompt } from "../lib/promptBuilders";
import { callOpenAI } from "../lib/openaiClient";
import { parseGrowthResult } from "../lib/modelSchemas";
import { SeedEditor } from "./SeedEditor";
import { SolasteridCanvas } from "./SolasteridCanvas";
import { TranscriptPanel } from "./TranscriptPanel";
import { AudioControls } from "./AudioControls";
import { ExportPanel } from "./ExportPanel";
import { RoundTimeline } from "./RoundTimeline";

type Props = {
  apiKey: string;
  onClearKey: () => void;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function GrowthConsole({ apiKey, onClearKey }: Props) {
  const [state, setState] = useState<SolasteridState>(() => createInitialSolasteridState());
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string>("");
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  const runOneRound = useCallback(async () => {
    const current = stateRef.current;
    setCurrentPhase("listening…");
    const prompt = buildGrowthPrompt(current);
    setCurrentPhase("deliberating…");
    const raw = await callOpenAI({ apiKey, prompt, model: "gpt-4.1-mini" });
    setCurrentPhase("mutating…");
    const parsed = parseGrowthResult(raw);
    setState((prev) => applyGrowthResult(prev, parsed));
    setCurrentPhase("");
  }, [apiKey]);

  useEffect(() => {
    if (!isRunning) return;

    let cancelled = false;

    async function loop() {
      while (!cancelled) {
        try {
          setError(null);
          await runOneRound();
          await delay(1100);
        } catch (err) {
          if (!cancelled) {
            setError(String(err));
            setIsRunning(false);
          }
          break;
        }
      }
    }

    loop();
    return () => { cancelled = true; };
  }, [isRunning, runOneRound]);

  function handleSeedApply(nextSeed: string) {
    setState((prev) => applyUserSeedUpdate(prev, nextSeed));
  }

  function handleReset() {
    if (!confirm("Reset this Solasterid to a fresh 5-arm state? This cannot be undone.")) return;
    setState(createInitialSolasteridState());
    setIsRunning(false);
    setError(null);
  }

  const activeCount = state.arms.filter((a) => a.status === "active").length;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #050d1a 0%, #061428 60%, #0a1410 100%)" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-cyan-300/10 px-4 py-2"
        style={{ background: "rgba(5,13,26,0.95)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-glow-teal text-cyan-200 tracking-widest uppercase">Solasterid Studio</h1>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>r{state.round}</span>
            <span>·</span>
            <span>{activeCount} arms</span>
            <span>·</span>
            <span>{state.committees.length} committees</span>
          </div>
          {isRunning && (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.1, repeat: Infinity }}
              className="flex items-center gap-1.5 text-xs text-teal-400"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              {currentPhase || "growing…"}
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            reset
          </button>
          <button
            onClick={onClearKey}
            className="rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-500 hover:text-rose-300 transition-colors"
          >
            clear key
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-8 pt-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Growth controls */}
            <section className="glass-panel p-4" style={{ borderColor: "rgba(103,232,249,0.18)" }}>
              <h2 className="text-sm font-bold text-cyan-200 text-glow-teal tracking-wide">GROWTH CONTROLS</h2>

              <div className="mt-3 flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: "0 0 20px rgba(103,232,249,0.35)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsRunning(true)}
                  disabled={isRunning}
                  className="flex-1 rounded-xl py-2.5 text-sm font-bold text-slate-950 transition-all disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #67e8f9, #0d9488)" }}
                >
                  Begin Growth
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsRunning(false)}
                  disabled={!isRunning}
                  className="flex-1 rounded-xl border border-slate-700/50 bg-slate-900/60 py-2.5 text-sm font-bold text-slate-300 transition-all disabled:opacity-40"
                >
                  Pause
                </motion.button>
              </div>

              {/* Stats */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "round", value: state.round, color: "#67e8f9" },
                  { label: "active arms", value: activeCount, color: "#5eead4" },
                  { label: "committees", value: state.committees.length, color: "#f0abfc" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl bg-slate-950/60 py-2 px-1">
                    <div className="text-lg font-bold font-mono" style={{ color }}>{value}</div>
                    <div className="text-[9px] text-slate-600 uppercase tracking-wide">{label}</div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">
                The run never pauses for seed checkpoints. Every 5 rounds, tempseed is automatically injected.
              </p>
            </section>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-rose-400/30 bg-rose-950/40 p-3 text-xs text-rose-200 leading-relaxed"
                >
                  <div className="font-bold mb-1">Error — run paused</div>
                  {error}
                  <button
                    onClick={() => { setError(null); setIsRunning(true); }}
                    className="mt-2 block text-rose-400 underline text-[10px]"
                  >
                    Retry
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <SeedEditor tempseed={state.tempseed} round={state.round} onApply={handleSeedApply} />
            <AudioControls state={state} />
            <RoundTimeline state={state} />
            <ExportPanel state={state} />
          </aside>

          {/* Main panel */}
          <main className="space-y-4">
            <SolasteridCanvas state={state} />
            <TranscriptPanel transcript={state.transcript} />
          </main>
        </div>
      </div>
    </div>
  );
}
