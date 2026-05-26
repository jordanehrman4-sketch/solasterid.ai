import { motion, AnimatePresence } from "framer-motion";
import type { CSSProperties } from "react";
import type {
  SolasteridArm,
  SolasteridCommittee,
  TranscriptEvent,
} from "../lib/solasteridState";

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
  active: "#A8E6B2",
  probation: "#FFE3A6",
  retired: "#8FA1AB",
};

export function ArmDetailPanel({ arm, committees, transcript, onClose }: Props) {
  if (!arm) return null;

  const armCommittees = committees.filter(
    (c) => c.armIds.includes(arm.id) || arm.committeeIds.includes(c.id),
  );

  const armEvents = transcript
    .filter(
      (e) => e.speaker === arm.name || e.speaker === arm.id || e.content.includes(arm.id),
    )
    .slice(-6)
    .reverse();

  const statusColor = STATUS_COLORS[arm.status] ?? "#8FA1AB";
  const statusLabel = STATUS_LABELS[arm.status] ?? arm.status;
  const accent = arm.color ?? "#8FFFE6";

  return (
    <AnimatePresence>
      <motion.div
        key={arm.id}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="glass-panel glass-panel--strong absolute right-4 top-20 z-20 flex flex-col gap-3 overflow-y-auto"
        style={{
          maxWidth: 290,
          maxHeight: "calc(100% - 120px)",
          padding: 16,
          borderColor: `${accent}44`,
          boxShadow: "0 10px 28px rgba(10,33,56,0.35)",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="h-3 w-3 flex-shrink-0 rounded-full"
              style={{ background: accent }}
            />
            <span
              className="truncate font-display font-semibold text-[14.5px]"
              style={{ color: "var(--text-strong)" }}
            >
              {arm.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost flex-shrink-0"
            style={{ padding: "3px 9px", fontSize: 14, lineHeight: 1 }}
            aria-label="close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span
            className="rounded-full px-2.5 py-0.5 text-[10.5px] font-display"
            style={{
              background: statusColor + "1A",
              color: statusColor,
              border: `1px solid ${statusColor}38`,
              letterSpacing: "0.1em",
            }}
          >
            {statusLabel}
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 mono text-[10.5px]"
            style={{
              background: "rgba(7,21,35,0.65)",
              color: "var(--text-mute)",
              border: "1px solid rgba(143,255,230,0.06)",
            }}
          >
            {arm.id}
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-[10.5px]"
            style={{
              background: "rgba(7,21,35,0.65)",
              color: "var(--text-soft)",
              border: "1px solid rgba(143,255,230,0.06)",
            }}
          >
            born r{arm.createdRound}
          </span>
          {arm.retiredRound && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10.5px]"
              style={{
                background: "rgba(7,21,35,0.65)",
                color: "var(--text-soft)",
                border: "1px solid rgba(143,255,230,0.06)",
              }}
            >
              retired r{arm.retiredRound}
            </span>
          )}
        </div>

        <div>
          <div className="eyebrow" style={{ fontSize: 9.5 }}>
            Lens
          </div>
          <p
            className="mt-1 text-[12px] leading-relaxed"
            style={{ color: "var(--text)", textWrap: "pretty" } as CSSProperties}
          >
            {arm.role || "No lens defined."}
          </p>
        </div>

        {armCommittees.length > 0 && (
          <div>
            <div className="eyebrow" style={{ fontSize: 9.5 }}>
              Committees
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {armCommittees.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full px-2.5 py-0.5 text-[10.5px]"
                  style={{
                    background: (c.color ?? "#64F5E6") + "18",
                    color: c.color ?? "#64F5E6",
                    border: `1px solid ${(c.color ?? "#64F5E6")}30`,
                  }}
                >
                  {c.name.slice(0, 28)}
                </span>
              ))}
            </div>
          </div>
        )}

        {armEvents.length > 0 && (
          <div>
            <div className="eyebrow" style={{ fontSize: 9.5 }}>
              Recent deliberations
            </div>
            <div className="mt-1.5 space-y-1.5">
              {armEvents.map((e) => (
                <div
                  key={e.id}
                  className="rounded-xl p-2.5 text-[11px] leading-relaxed"
                  style={{
                    background: "rgba(7,21,35,0.55)",
                    border: "1px solid rgba(143,255,230,0.08)",
                    color: "var(--text-soft)",
                  }}
                >
                  <span className="mr-1 mono" style={{ color: "var(--text-mute)" }}>
                    r{e.round}
                  </span>
                  {e.content.slice(0, 140)}
                  {e.content.length > 140 ? "…" : ""}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
