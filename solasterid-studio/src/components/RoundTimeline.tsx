import { motion } from "framer-motion";
import type { SolasteridState } from "../lib/solasteridState";

type Props = { state: SolasteridState };

export function RoundTimeline({ state }: Props) {
  // Build a per-round summary from mutations
  const roundData = Array.from({ length: state.round }, (_, i) => {
    const r = i + 1;
    const mutations = state.mutations.filter((m) => m.round === r);
    const added = mutations.filter((m) => m.type === "add_arm").length;
    const retired = mutations.filter((m) => m.type === "retire_arm").length;
    const seeded = r % 5 === 0 || r === 1;
    const armCount = state.arms.filter(
      (a) => a.createdRound <= r && (!a.retiredRound || a.retiredRound > r)
    ).length;
    return { r, added, retired, seeded, armCount, mutations: mutations.length };
  }).reverse().slice(0, 30); // show last 30 rounds, newest first

  if (state.round === 0) {
    return (
      <section className="glass-panel p-4" style={{ borderColor: "rgba(100,116,139,0.15)" }}>
        <h2 className="text-sm font-bold text-slate-400 tracking-wide">ROUND TIMELINE</h2>
        <p className="mt-2 text-xs text-slate-600 italic">Begin growth to see the timeline.</p>
      </section>
    );
  }

  return (
    <section className="glass-panel p-4" style={{ borderColor: "rgba(100,116,139,0.15)" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-400 tracking-wide">ROUND TIMELINE</h2>
        <span className="text-[10px] text-slate-600 font-mono">r{state.round}</span>
      </div>

      <div className="max-h-40 overflow-y-auto space-y-1">
        {roundData.map(({ r, added, retired, seeded, armCount, mutations }) => (
          <motion.div
            key={r}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-2 rounded-xl px-2 py-1"
            style={{
              background: r === state.round ? "rgba(103,232,249,0.07)" : "rgba(15,23,42,0.4)",
              border: r === state.round ? "1px solid rgba(103,232,249,0.2)" : "1px solid transparent",
            }}
          >
            {/* Round badge */}
            <div
              className="flex h-6 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[9px] font-bold font-mono"
              style={{
                background: seeded ? "rgba(45,212,191,0.15)" : "rgba(30,41,59,0.8)",
                color: seeded ? "#2dd4bf" : "#475569",
                border: seeded ? "1px solid rgba(45,212,191,0.3)" : "1px solid rgba(71,85,105,0.2)",
              }}
            >
              {r}
            </div>

            {/* Arm count bar */}
            <div className="flex-1">
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: Math.min(100, (armCount / 20) * 100) + "%",
                    background: "linear-gradient(90deg, #5eead4, #7dd3fc)",
                  }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-1.5 text-[9px] font-mono flex-shrink-0">
              <span style={{ color: "#94a3b8" }}>{armCount}a</span>
              {added > 0 && <span style={{ color: "#4ade80" }}>+{added}</span>}
              {retired > 0 && <span style={{ color: "#f87171" }}>-{retired}</span>}
              {mutations > 0 && added === 0 && retired === 0 && (
                <span style={{ color: "#fde68a" }}>~{mutations}</span>
              )}
              {seeded && <span style={{ color: "#2dd4bf" }}>⟳</span>}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-2 flex gap-3 text-[9px] text-slate-600">
        <span><span className="text-slate-400">r</span> = round</span>
        <span><span className="text-green-400">+n</span> added</span>
        <span><span className="text-red-400">-n</span> retired</span>
        <span><span className="text-teal-400">⟳</span> seed injection</span>
      </div>
    </section>
  );
}
