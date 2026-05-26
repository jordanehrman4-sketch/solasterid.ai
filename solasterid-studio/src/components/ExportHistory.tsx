import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  deleteExportRecord,
  listExportRecords,
  type SavedSolasteridExport,
} from "../lib/indexedDbExports";
import { downloadBlob } from "../lib/exportSolasterid";

export function ExportHistory() {
  const [records, setRecords] = useState<SavedSolasteridExport[]>([]);
  const [inspecting, setInspecting] = useState<string | null>(null);

  async function refresh() {
    try {
      setRecords(await listExportRecords());
    } catch {
      // IndexedDB unavailable
    }
  }

  useEffect(() => { refresh(); }, []);

  async function remove(id: string) {
    await deleteExportRecord(id);
    await refresh();
    if (inspecting === id) setInspecting(null);
  }

  if (records.length === 0) {
    return (
      <p className="mt-3 text-[10px] text-slate-600 italic">
        No local Solasterid fossils yet. Export after round 25 to start collecting.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Local Fossils</h3>
      <AnimatePresence>
        {records.map((rec) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -16 }}
            className="rounded-xl border border-slate-700/50 bg-slate-950/70 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[11px] font-bold text-amber-200">{rec.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-slate-500 font-mono">
                  <span>r{rec.round}</span>
                  <span>{rec.armCount} arms</span>
                  <span>{rec.committeeCount} committees</span>
                </div>
                <div className="mt-0.5 text-[9px] text-slate-600">{new Date(rec.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex flex-shrink-0 gap-1.5">
                <button
                  onClick={() => downloadBlob(rec.zipBlob, rec.name)}
                  className="rounded-lg bg-amber-900/40 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-900/60 transition-colors border border-amber-700/30"
                >
                  ↓
                </button>
                <button
                  onClick={() => setInspecting(inspecting === rec.id ? null : rec.id)}
                  className="rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-700 transition-colors border border-slate-700/50"
                >
                  {inspecting === rec.id ? "close" : "inspect"}
                </button>
                <button
                  onClick={() => remove(rec.id)}
                  className="rounded-lg bg-rose-950/40 px-2 py-1 text-[10px] text-rose-400 hover:bg-rose-950/70 transition-colors border border-rose-800/30"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Seed preview */}
            <div className="mt-2 text-[10px] text-slate-500 italic leading-relaxed">
              "{rec.seedPreview.slice(0, 160)}{rec.seedPreview.length > 160 ? "…" : ""}"
            </div>

            {/* Inspect panel */}
            <AnimatePresence>
              {inspecting === rec.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-xl bg-slate-900/60 border border-slate-700/40 p-3 text-[10px] font-mono text-slate-400 space-y-1">
                    <div><span className="text-slate-600">round:</span> {rec.round}</div>
                    <div><span className="text-slate-600">version:</span> {rec.version}</div>
                    <div><span className="text-slate-600">active arms:</span> {rec.armCount}</div>
                    <div><span className="text-slate-600">committees:</span> {rec.committeeCount}</div>
                    <div><span className="text-slate-600">exported:</span> {new Date(rec.createdAt).toISOString()}</div>
                    <div className="pt-1">
                      <span className="text-slate-600">arms: </span>
                      {rec.stateJson.arms.filter((a) => a.status === "active").map((a) => a.name).join(", ")}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
