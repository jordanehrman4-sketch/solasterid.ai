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
        className="btn w-full text-left"
        style={{ justifyContent: "flex-start", fontSize: 12, fontWeight: 500 }}
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
            style={{ background: "rgba(3,17,31,0.85)", backdropFilter: "blur(8px)" }}
            onClick={(e) => e.target === e.currentTarget && cancel()}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="glass-panel glass-panel--strong w-full max-w-md p-6"
              style={{ borderColor: "rgba(143,255,230,0.22)" }}
            >
              <div className="eyebrow">Import Architecture</div>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--text-soft)" }}>
                Load a <code className="mono" style={{ color: "var(--foam)" }}>architecture_state.json</code>
                {" "}from a v4 notebook run. This replaces the current creature — export first if you want
                to keep its fossil.
              </p>

              <label
                className="mt-4 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed p-6 transition-colors"
                style={{
                  borderColor: "rgba(143,255,230,0.22)",
                  background: "rgba(7,21,35,0.55)",
                }}
              >
                <div className="text-2xl">🌊</div>
                <div className="mt-2 text-[12.5px]" style={{ color: "var(--text)" }}>
                  Drop or click to load architecture_state.json
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json"
                  className="sr-only"
                  onChange={handleFile}
                />
              </label>

              {error && (
                <div
                  className="mt-3 rounded-2xl p-3 text-[11.5px]"
                  style={{
                    background: "rgba(255,111,145,0.06)",
                    border: "1px solid rgba(255,111,145,0.25)",
                    color: "#FFB8C5",
                  }}
                >
                  {error}
                </div>
              )}

              {preview && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-2xl p-4"
                  style={{
                    background: "rgba(143,255,230,0.06)",
                    border: "1px solid rgba(143,255,230,0.22)",
                  }}
                >
                  <div className="eyebrow mb-2">Architecture preview</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]">
                    <span style={{ color: "var(--text-mute)" }}>Version</span>
                    <span className="mono" style={{ color: "var(--foam)" }}>{preview.version}</span>
                    <span style={{ color: "var(--text-mute)" }}>Active arms</span>
                    <span className="mono" style={{ color: "var(--foam)" }}>{preview.activeArmCount}</span>
                    <span style={{ color: "var(--text-mute)" }}>Total arms</span>
                    <span className="mono" style={{ color: "var(--foam)" }}>{preview.armCount}</span>
                    <span style={{ color: "var(--text-mute)" }}>Committees</span>
                    <span className="mono" style={{ color: "var(--foam)" }}>{preview.committeeCount}</span>
                    <span style={{ color: "var(--text-mute)" }}>ID</span>
                    <span className="mono truncate" style={{ color: "var(--text-soft)" }}>
                      {preview.architectureId.slice(0, 24)}
                    </span>
                  </div>
                </motion.div>
              )}

              <div className="mt-5 flex gap-3">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 1 }}
                  onClick={confirm}
                  disabled={!pendingState}
                  className="btn btn-primary flex-1"
                  style={{ padding: "10px 14px", fontSize: 13 }}
                >
                  Load Architecture
                </motion.button>
                <button onClick={cancel} className="btn flex-1">
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
