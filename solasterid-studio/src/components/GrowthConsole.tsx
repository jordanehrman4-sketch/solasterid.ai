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
import { ImportArchitecture } from "./ImportArchitecture";
import { MilestoneToast } from "./MilestoneToast";

const MODELS = [
  { id: "gpt-4.1-mini", label: "gpt-4.1-mini", note: "fast · cheap" },
  { id: "gpt-4.1", label: "gpt-4.1", note: "smart · costly" },
  { id: "gpt-4o-mini", label: "gpt-4o-mini", note: "alt fast" },
  { id: "gpt-4o", label: "gpt-4o", note: "alt smart" },
];

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
  const [roundDelay, setRoundDelay] = useState(1200);
  const [selectedModel, setSelectedModel] = useState("gpt-4.1-mini");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  const runOneRound = useCallback(async () => {
    const current = stateRef.current;
    setCurrentPhase("listening…");
    const prompt = buildGrowthPrompt(current);
    setCurrentPhase("deliberating…");
    const raw = await callOpenAI({ apiKey, prompt, model: selectedModel });
    setCurrentPhase("mutating…");
    const parsed = parseGrowthResult(raw);
    setState((prev) => applyGrowthResult(prev, parsed));
    setCurrentPhase("");
  }, [apiKey, selectedModel]);

  // Autonomous loop
  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;

    async function loop() {
      while (!cancelled) {
        try {
          setError(null);
          await runOneRound();
          await delay(roundDelay);
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
  }, [isRunning, runOneRound, roundDelay]);

  // Single step
  async function handleStep() {
    if (isRunning) return;
    try {
      setError(null);
      await runOneRound();
    } catch (err) {
      setError(String(err));
    }
  }

  function handleSeedApply(nextSeed: string) {
    setState((prev) => applyUserSeedUpdate(prev, nextSeed));
  }

  function handleImport(importedState: SolasteridState) {
    setIsRunning(false);
    setState(importedState);
    setError(null);
  }

  function handleReset() {
    if (!confirm("Reset to a fresh 5-arm state? Export first if you want to keep this creature.")) return;
    setState(createInitialSolasteridState());
    setIsRunning(false);
    setError(null);
  }

  const activeCount = state.arms.filter((a) => a.status === "active").length;
  const retiredCount = state.arms.filter((a) => a.status === "retired").length;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #050d1a 0%, #061428 60%, #0a1410 100%)" }}>
      {/* Milestone toasts (portal-like fixed overlay) */}
      <MilestoneToast activeArmCount={activeCount} />

      {/* Top bar */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between border-b border-cyan-300/10 px-4 py-2"
        style={{ background: "rgba(5,13,26,0.95)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="flex-shrink-0 text-sm font-bold text-glow-teal text-cyan-200 tracking-widest uppercase">
            Solasterid Studio
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>r{state.round}</span>
            <span>·</span>
            <span className="text-cyan-400">{activeCount}</span>
            <span className="text-slate-600">active</span>
            {retiredCount > 0 && (
              <>
                <span>·</span>
                <span className="text-slate-600">{retiredCount} fossil</span>
              </>
            )}
            <span>·</span>
            <span className="text-fuchsia-400">{state.committees.length}</span>
            <span className="text-slate-600">committees</span>
          </div>
          {isRunning && (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.1, repeat: Infinity }}
              className="flex flex-shrink-0 items-center gap-1.5 text-xs text-teal-400"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              {currentPhase || "growing…"}
            </motion.div>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
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

              {/* Run / Pause / Step */}
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

              {/* Step button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStep}
                disabled={isRunning}
                className="mt-2 w-full rounded-xl border border-slate-700/40 bg-slate-900/40 py-2 text-xs text-slate-400 hover:text-slate-200 transition-all disabled:opacity-30"
              >
                Step one round →
              </motion.button>

              {/* Stats */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "round", value: state.round, color: "#67e8f9" },
                  { label: "active", value: activeCount, color: "#5eead4" },
                  { label: "committees", value: state.committees.length, color: "#f0abfc" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl bg-slate-950/60 py-2 px-1">
                    <div className="text-lg font-bold font-mono" style={{ color }}>{value}</div>
                    <div className="text-[9px] text-slate-600 uppercase tracking-wide">{label}</div>
                  </div>
                ))}
              </div>

              {/* Advanced toggle */}
              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="mt-3 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
              >
                {showAdvanced ? "▴ hide advanced" : "▾ advanced options"}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
                      {/* Speed slider */}
                      <div>
                        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                          <span>Round delay</span>
                          <span className="font-mono text-slate-400">{(roundDelay / 1000).toFixed(1)}s</span>
                        </div>
                        <input
                          type="range"
                          min="400"
                          max="8000"
                          step="100"
                          value={roundDelay}
                          onChange={(e) => setRoundDelay(Number(e.target.value))}
                          className="w-full accent-cyan-400"
                        />
                        <div className="flex justify-between text-[9px] text-slate-700 mt-0.5">
                          <span>0.4s fast</span>
                          <span>8s slow</span>
                        </div>
                      </div>

                      {/* Model selector */}
                      <div>
                        <div className="mb-1.5 text-[10px] text-slate-500">Model</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {MODELS.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => setSelectedModel(m.id)}
                              className="rounded-xl border px-2 py-1.5 text-left transition-all"
                              style={{
                                borderColor: selectedModel === m.id ? "rgba(103,232,249,0.4)" : "rgba(71,85,105,0.3)",
                                background: selectedModel === m.id ? "rgba(103,232,249,0.08)" : "rgba(15,23,42,0.5)",
                              }}
                            >
                              <div className="text-[10px] font-bold" style={{ color: selectedModel === m.id ? "#67e8f9" : "#94a3b8" }}>
                                {m.label}
                              </div>
                              <div className="text-[9px] text-slate-600">{m.note}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">
                Run never pauses for seed checkpoints. Every 5 rounds, tempseed is automatically injected.
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
                  <div className="font-bold mb-1 text-rose-300">Error — run paused</div>
                  <div className="text-[11px] text-rose-300/80 break-all">{error}</div>
                  <button
                    onClick={() => { setError(null); setIsRunning(true); }}
                    className="mt-2 text-[10px] text-rose-400 underline"
                  >
                    Retry
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Import v4 architecture */}
            <ImportArchitecture onImport={handleImport} />

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
