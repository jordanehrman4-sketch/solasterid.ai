import { useState } from "react";
import { motion } from "framer-motion";
import type { SolasteridState } from "../lib/solasteridState";
import { buildSolasteridExportZip, downloadBlob } from "../lib/exportSolasterid";
import { saveExportRecord } from "../lib/indexedDbExports";
import { ExportHistory } from "./ExportHistory";

type Props = { state: SolasteridState };

export function ExportPanel({ state }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const roundsLeft = Math.max(0, 25 - state.round);

  async function exportNow() {
    if (!state.exportUnlocked || exporting) return;
    setExporting(true);
    try {
      const blob = await buildSolasteridExportZip(state);
      const createdAt = new Date().toISOString();
      const activeArmCount = state.arms.filter((a) => a.status === "active").length;
      const filename = `solasterid_r${state.round}_${Date.now()}.zip`;

      downloadBlob(blob, filename);

      try {
        await saveExportRecord({
          id: crypto.randomUUID(),
          createdAt,
          name: filename,
          round: state.round,
          version: state.version,
          armCount: activeArmCount,
          committeeCount: state.committees.length,
          seedPreview: state.tempseed.slice(0, 240),
          stateJson: state,
          zipBlob: blob,
        });
      } catch {
        // IndexedDB may be unavailable
      }

      setMessage("Fossil saved locally and downloaded.");
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage("Export failed: " + String(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="glass-panel p-4" style={{ borderColor: "rgba(251,191,36,0.2)" }}>
      <h2 className="text-sm font-bold text-amber-200 tracking-wide">EXPORT FOSSIL</h2>

      {!state.exportUnlocked ? (
        <div className="mt-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            The fossil lock holds until round 25.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #fbbf24, #f97316)", width: ((state.round / 25) * 100) + "%" }}
                animate={{ width: ((state.round / 25) * 100) + "%" }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <span className="text-[10px] font-mono text-amber-400">{roundsLeft}r left</span>
          </div>
          <p className="mt-2 text-[10px] text-slate-600 italic">
            Survive 25 rounds to export your Solasterid.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Your Solasterid has survived {state.round} rounds.
          </p>
          <p className="mt-1 text-[11px] text-amber-400/80 italic">
            The creature's fossil is saved. The user's API key is not.
          </p>

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(251,191,36,0.3)" }}
            whileTap={{ scale: 0.97 }}
            onClick={exportNow}
            disabled={exporting}
            className="mt-3 w-full rounded-xl py-2.5 text-sm font-bold text-slate-950 transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #fbbf24, #f97316)" }}
          >
            {exporting ? "Exporting…" : "Export My Solasterid"}
          </motion.button>
        </>
      )}

      {message && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-xl border border-amber-400/20 bg-amber-950/30 p-2.5 text-xs text-amber-200"
        >
          {message}
        </motion.div>
      )}

      <ExportHistory />
    </section>
  );
}
