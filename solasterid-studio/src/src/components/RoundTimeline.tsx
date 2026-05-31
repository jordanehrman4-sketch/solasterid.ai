import { motion } from "framer-motion";
import type { SolasteridState } from "../lib/solasteridState";

type Props = { state: SolasteridState };

export function RoundTimeline({ state }: Props) {
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
  }).reverse().slice(0, 30);

  if (state.round === 0) {
    return (
      <section className="glass-panel" style={{ padding: 16 }}>
        <div className="eyebrow">Round Timeline</div>
        <p className="mt-2 text-[11.5px] italic" style={{ color: "var(--text-mute)" }}>
          Begin growth to see the timeline.
        </p>
      </section>
    );
  }

  return (
    <section className="glass-panel" style={{ padding: 16 }}>
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow">Round Timeline</div>
        <span className="text-[10.5px] mono" style={{ color: "var(--text-mute)" }}>
          r{state.round}
        </span>
      </div>

      <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
        {roundData.map(({ r, added, retired, seeded, armCount, mutations }) => {
          const isCurrent = r === state.round;
          return (
            <motion.div
              key={r}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5"
              style={{
                background: isCurrent ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.45)",
                border: `1px solid ${
                  isCurrent ? "rgba(100,245,230,0.25)" : "rgba(10,33,56,0.04)"
                }`,
              }}
            >
              <div
                className="flex h-6 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-display font-semibold mono"
                style={{
                  background: seeded ? "rgba(10,33,56,0.12)" : "rgba(7,21,35,0.8)",
                  color: seeded ? "var(--foam)" : "var(--text-mute)",
                  border: `1px solid ${
                    seeded ? "rgba(10,33,56,0.28)" : "rgba(10,33,56,0.06)"
                  }`,
                }}
              >
                {r}
              </div>

              <div className="flex-1">
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      width: Math.min(100, (armCount / 20) * 100) + "%",
                      background: "linear-gradient(90deg, #A8E6B2, #64F5E6)",
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-1.5 text-[10px] mono flex-shrink-0">
                <span style={{ color: "var(--text-soft)" }}>{armCount}a</span>
                {added > 0 && <span style={{ color: "#A8E6B2" }}>+{added}</span>}
                {retired > 0 && <span style={{ color: "#FF9A98" }}>-{retired}</span>}
                {mutations > 0 && added === 0 && retired === 0 && (
                  <span style={{ color: "#FFD166" }}>~{mutations}</span>
                )}
                {seeded && <span style={{ color: "var(--foam)" }}>⟳</span>}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-2.5 flex gap-3 text-[10px]" style={{ color: "var(--text-mute)" }}>
        <span>
          <span style={{ color: "var(--text-soft)" }}>r</span> round
        </span>
        <span>
          <span style={{ color: "#A8E6B2" }}>+n</span> added
        </span>
        <span>
          <span style={{ color: "#FF9A98" }}>-n</span> retired
        </span>
        <span>
          <span style={{ color: "var(--foam)" }}>⟳</span> seed tide
        </span>
      </div>
    </section>
  );
}
