import { motion, AnimatePresence } from "framer-motion";
import type { SolasteridArm, SolasteridCommittee, TranscriptEvent } from "../lib/solasteridState";

type Props = {
  arm: SolasteridArm | null;
  committees: SolasteridCommittee[];
  transcript: TranscriptEvent[];
  onClose: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  active: "active",
  probation: "probation",
  retired: "fossilized",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#5eead4",
  probation: "#fde68a",
  retired: "#475569",
};

export function ArmDetailPanel({ arm, committees, transcript, onClose }: Props) {
  if (!arm) return null;

  const armCommittees = committees.filter((c) => c.armIds.includes(arm.id) || arm.committeeIds.includes(c.id));

  // Last 6 transcript events where this arm spoke
  const armEvents = transcript
    .filter((e) => e.speaker === arm.name || e.speaker === arm.id || e.content.includes(arm.id))
    .slice(-6)
    .reverse();

  const statusColor = STATUS_COLORS[arm.status] ?? "#94a3b8";
  const statusLabel = STATUS_LABELS[arm.status] ?? arm.status;

  return (
    <AnimatePresence>
      <motion.div
        key={arm.id}
        initial={{ opacity: 0, x: 32 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 32 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="glass-panel absolute right-3 top-3 z-20 flex flex-col gap-3 overflow-y-auto p-4"
        style={{
          maxWidth: 260,
          maxHeight: "calc(100% - 80px)",
          borderColor: (arm.color ?? "#67e8f9") + "40",
          boxShadow: `0 0 32px ${arm.color ?? "#67e8f9"}20`,
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="h-3 w-3 flex-shrink-0 rounded-full"
              style={{ background: arm.color ?? "#67e8f9", boxShadow: `0 0 6px ${arm.color ?? "#67e8f9"}` }}
            />
            <span className="truncate text-sm font-bold" style={{ color: arm.color ?? "#67e8f9" }}>
              {arm.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            style={{ background: "rgba(15,23,42,0.6)" }}
          >
            ×
          </button>
        </div>

        {/* Status + id */}
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <span
            className="rounded-full px-2 py-0.5 font-bold uppercase tracking-wide"
            style={{ background: statusColor + "18", color: statusColor, border: `1px solid ${statusColor}35` }}
          >
            {statusLabel}
          </span>
          <span className="rounded-full bg-slate-900 px-2 py-0.5 font-mono text-slate-500">
            {arm.id}
          </span>
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-slate-600">
            born r{arm.createdRound}
          </span>
          {arm.retiredRound && (
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-slate-600">
              retired r{arm.retiredRound}
            </span>
          )}
        </div>

        {/* Role / Lens */}
        <div>
          <div className="mb-1 text-[9px] uppercase tracking-widest text-slate-600">Lens</div>
          <p className="text-[11px] leading-relaxed text-slate-300">{arm.role || "No lens defined."}</p>
        </div>

        {/* Committees */}
        {armCommittees.length > 0 && (
          <div>
            <div className="mb-1.5 text-[9px] uppercase tracking-widest text-slate-600">Committees</div>
            <div className="flex flex-wrap gap-1.5">
              {armCommittees.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    background: (c.color ?? "#67e8f9") + "18",
                    color: c.color ?? "#67e8f9",
                    border: `1px solid ${c.color ?? "#67e8f9"}30`,
                  }}
                >
                  {c.name.slice(0, 28)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent transcript */}
        {armEvents.length > 0 && (
          <div>
            <div className="mb-1.5 text-[9px] uppercase tracking-widest text-slate-600">
              Recent deliberations
            </div>
            <div className="space-y-1.5">
              {armEvents.map((e) => (
                <div
                  key={e.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-[10px] leading-relaxed text-slate-400"
                >
                  <span className="mr-1 text-slate-600">r{e.round}</span>
                  {e.content.slice(0, 120)}{e.content.length > 120 ? "…" : ""}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
