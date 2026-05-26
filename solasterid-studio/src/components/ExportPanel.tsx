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
        // IndexedDB unavailable
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
    <section className="glass-panel" style={{ padding: 16, borderColor: "rgba(255,209,102,0.18)" }}>
      <div className="eyebrow">Export Fossil</div>

      {!state.exportUnlocked ? (
        <div className="mt-3">
          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
            The fossil lock holds until round 25.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="progress-track flex-1">
              <motion.div
                className="progress-fill progress-fill--plankton"
                animate={{ width: ((state.round / 25) * 100) + "%" }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <span className="text-[10.5px] mono" style={{ color: "var(--plankton)" }}>
              {roundsLeft}r left
            </span>
          </div>
          <p className="mt-2 text-[10.5px] italic" style={{ color: "var(--text-mute)" }}>
            Survive 25 rounds to export your Solasterid.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--text)" }}>
            Your Solasterid has survived {state.round} rounds.
          </p>
          <p
            className="mt-1 text-[11px] italic"
            style={{ color: "rgba(255,209,102,0.85)" }}
          >
            The creature's fossil is saved. The user's API key is not.
          </p>

          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ y: 1 }}
            onClick={exportNow}
            disabled={exporting}
            className="btn mt-3 w-full"
            style={{
              background: "linear-gradient(135deg, #FFD166, #FF9A76)",
              color: "#2A1B07",
              border: "1px solid rgba(255,209,102,0.5)",
              fontWeight: 600,
              padding: "10px 16px",
              fontSize: 13,
            }}
          >
            {exporting ? "Exporting…" : "Take My Solasterid Home"}
          </motion.button>
        </>
      )}

      {message && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-2xl p-2.5 text-[11.5px]"
          style={{
            background: "rgba(255,209,102,0.06)",
            border: "1px solid rgba(255,209,102,0.2)",
            color: "#FFE6A3",
          }}
        >
          {message}
        </motion.div>
      )}

      <ExportHistory />
    </section>
  );
}
