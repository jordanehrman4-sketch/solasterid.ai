import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { convertV4Architecture, type SolasteridState } from "../lib/solasteridState";

type Props = {
  onImport: (state: SolasteridState) => void;
};

type Preview = {
  armCount: number;
  activeArmCount: number;
  committeeCount: number;
  version: number;
  architectureId: string;
};

export function ImportArchitecture({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pendingState, setPendingState] = useState<SolasteridState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(null);
    setPendingState(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = JSON.parse(ev.target?.result as string) as any;
        const converted = convertV4Architecture(raw);
        setPreview({
          armCount: converted.arms.length,
          activeArmCount: converted.arms.filter((a) => a.status === "active").length,
          committeeCount: converted.committees.length,
          version: converted.version,
          architectureId: (raw.architecture_id as string) ?? "unknown",
        });
        setPendingState(converted);
      } catch (err) {
        setError("Could not parse this file as a Solasterid v4 architecture_state.json. " + String(err));
      }
    };
    reader.readAsText(file);
  }

  function confirm() {
    if (!pendingState) return;
    onImport(pendingState);
    setOpen(false);
    setPreview(null);
    setPendingState(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function cancel() {
    setOpen(false);
    setPreview(null);
    setPendingState(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-slate-700/50 bg-slate-900/50 px-3 py-2 text-xs text-slate-400 hover:border-cyan-400/30 hover:text-cyan-300 transition-all text-left"
      >
        ↑ Import v4 architecture…
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(5,13,26,0.85)", backdropFilter: "blur(8px)" }}
            onClick={(e) => e.target === e.currentTarget && cancel()}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="glass-panel w-full max-w-md p-6"
              style={{ borderColor: "rgba(103,232,249,0.2)" }}
            >
              <h2 className="text-base font-bold text-cyan-200">Import Solasterid Architecture</h2>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Load a <code className="text-cyan-400">architecture_state.json</code> from a v4 notebook run.
                This will replace the current creature — the fossil of the running one will be lost unless you export first.
              </p>

              <label className="mt-4 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-cyan-300/20 bg-slate-950/60 p-6 transition-colors hover:border-cyan-300/40">
                <div className="text-2xl">🌊</div>
                <div className="mt-2 text-sm text-slate-400">Drop or click to load architecture_state.json</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json"
                  className="sr-only"
                  onChange={handleFile}
                />
              </label>

              {error && (
                <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-950/30 p-3 text-xs text-rose-300">
                  {error}
                </div>
              )}

              {preview && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-2xl border border-teal-400/20 bg-teal-950/20 p-4"
                >
                  <div className="text-xs font-bold text-teal-300 mb-2">Architecture preview</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    <span className="text-slate-500">Version</span>
                    <span className="text-teal-200 font-mono">{preview.version}</span>
                    <span className="text-slate-500">Active arms</span>
                    <span className="text-teal-200 font-mono">{preview.activeArmCount}</span>
                    <span className="text-slate-500">Total arms</span>
                    <span className="text-teal-200 font-mono">{preview.armCount}</span>
                    <span className="text-slate-500">Committees</span>
                    <span className="text-teal-200 font-mono">{preview.committeeCount}</span>
                    <span className="text-slate-500">ID</span>
                    <span className="text-slate-400 font-mono truncate">{preview.architectureId.slice(0, 24)}</span>
                  </div>
                </motion.div>
              )}

              <div className="mt-5 flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={confirm}
                  disabled={!pendingState}
                  className="flex-1 rounded-xl py-2.5 text-sm font-bold text-slate-950 disabled:opacity-40"
                  style={{ background: pendingState ? "linear-gradient(135deg, #67e8f9, #0d9488)" : "#475569" }}
                >
                  Load Architecture
                </motion.button>
                <button
                  onClick={cancel}
                  className="flex-1 rounded-xl border border-slate-700/50 bg-slate-900/60 py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
