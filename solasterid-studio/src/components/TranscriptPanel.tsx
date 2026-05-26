import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TranscriptEvent } from "../lib/solasteridState";

const PHASE_COLORS: Record<string, string> = {
  round_summary: "#67e8f9",
  arm_report: "#5eead4",
  speaker_decision: "#f0abfc",
  seed_update: "#fde68a",
  bootstrap: "#94a3b8",
};

const PHASE_LABELS: Record<string, string> = {
  round_summary: "summary",
  arm_report: "arm",
  speaker_decision: "speakerbot",
  seed_update: "seed",
  bootstrap: "init",
};

type Props = { transcript: TranscriptEvent[] };

function TranscriptBubble({ event }: { event: TranscriptEvent }) {
  const color = PHASE_COLORS[event.phase] ?? "#94a3b8";
  const label = PHASE_LABELS[event.phase] ?? event.phase;
  const isSpeaker = event.phase === "speaker_decision";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border bg-slate-950/60 p-3"
      style={{ borderColor: color + "30" }}
    >
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ background: color + "18", color, border: `1px solid ${color}35` }}
        >
          {label}
        </span>
        <span className="text-[10px] text-slate-600 font-mono">r{event.round}</span>
        {event.speaker && event.speaker !== "solasterid" && (
          <span className="text-[10px] text-slate-500">{event.speaker}</span>
        )}
      </div>

      <p
        className="text-xs leading-relaxed"
        style={{
          color: isSpeaker ? "#f0abfc" : "#cbd5e1",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxWidth: "100%",
          fontStyle: isSpeaker ? "italic" : undefined,
        }}
      >
        {event.content}
      </p>
    </motion.article>
  );
}

export function TranscriptPanel({ transcript }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new events
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [transcript.length]);

  const reversed = [...transcript].reverse();

  return (
    <section className="glass-panel" style={{ borderColor: "rgba(100,116,139,0.2)" }}>
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl px-4 py-3"
        style={{ background: "rgba(5,13,26,0.9)", borderBottom: "1px solid rgba(100,116,139,0.15)" }}>
        <h2 className="text-sm font-bold text-slate-300 tracking-wide">TRANSCRIPT TIDEPOOL</h2>
        <span className="text-[10px] text-slate-600 font-mono">{transcript.length} events</span>
      </div>

      <div
        ref={containerRef}
        className="max-h-96 overflow-y-auto p-3 space-y-2"
      >
        <AnimatePresence initial={false}>
          {reversed.map((event) => (
            <TranscriptBubble key={event.id} event={event} />
          ))}
        </AnimatePresence>
        {transcript.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-600 italic">
            The tidepool is quiet. Start growth to hear the arms deliberate.
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}
