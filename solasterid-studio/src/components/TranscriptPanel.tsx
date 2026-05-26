import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  TranscriptEvent,
  SolasteridArm,
  SolasteridCommittee,
} from "../lib/solasteridState";
import type { StreamPhase } from "../lib/openaiClient";
import { buildArmColorMap } from "../lib/armColors";
import { LiveStreamCard } from "./LiveStreamCard";
import { WordStream } from "./WordStream";

const PHASE_COLORS: Record<string, string> = {
  round_summary: "#64F5E6",
  arm_report: "#8FFFE6",
  speaker_decision: "#B99CFF",
  seed_update: "#FFD166",
  bootstrap: "#8FA1AB",
};

const PHASE_LABELS: Record<string, string> = {
  round_summary: "summary",
  arm_report: "arm",
  speaker_decision: "speakerbot",
  seed_update: "seed",
  bootstrap: "init",
};

type Props = {
  transcript: TranscriptEvent[];
  arms?: SolasteridArm[];
  committees?: SolasteridCommittee[];
  /** Event IDs to hide from the panel (because the canvas is playing them
   *  back committee-by-committee — they'll be revealed in order). */
  hiddenIds?: Set<string>;
  liveStreamText?: string;
  isStreaming?: boolean;
  currentPhase?: StreamPhase;
  elapsedMs?: number;
  charsReceived?: number;
};

function TranscriptCard({
  event,
  index,
  armColor,
  animate,
}: {
  event: TranscriptEvent;
  index: number;
  armColor?: string;
  /** When true, animate the content with word-by-word reveal. */
  animate: boolean;
}) {
  const color = PHASE_COLORS[event.phase] ?? "#8FA1AB";
  const label = PHASE_LABELS[event.phase] ?? event.phase;
  const isSpeaker = event.phase === "speaker_decision";
  const isArmReport = event.phase === "arm_report";
  const accent = isArmReport && armColor ? armColor : color;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.42, delay: Math.min(index * 0.04, 0.2), ease: [0.2, 0.7, 0.2, 1] }}
      className="glass-panel"
      style={{
        padding: 14,
        borderColor: accent + "26",
      }}
    >
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        {isArmReport && armColor && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: armColor,
              boxShadow: "none",
              flexShrink: 0,
            }}
          />
        )}
        <span
          className="rounded-full px-2.5 py-[3px] text-[9.5px] font-display"
          style={{
            background: color + "1A",
            color,
            border: `1px solid ${color}30`,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span className="text-[10.5px] mono" style={{ color: "var(--text-mute)" }}>
          r{event.round}
        </span>
        {event.speaker && event.speaker !== "solasterid" && (
          <span
            className="text-[10.5px] font-display font-medium"
            style={{ color: isArmReport && armColor ? armColor : "var(--text-soft)" }}
          >
            {event.speaker}
          </span>
        )}
      </div>

      <p
        className="text-[12.5px] leading-relaxed"
        style={{
          color: isSpeaker ? "#E2D6FF" : "var(--text)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxWidth: "100%",
          fontStyle: isSpeaker ? "italic" : undefined,
          textWrap: "pretty",
        }}
      >
        <WordStream text={event.content} instant={!animate} speedMs={isSpeaker ? 38 : 22} />
      </p>
    </motion.article>
  );
}

export function TranscriptPanel({
  transcript,
  arms = [],
  committees = [],
  hiddenIds,
  liveStreamText = "",
  isStreaming = false,
  currentPhase = "idle",
  elapsedMs = 0,
  charsReceived = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoFollowRef = useRef(true);

  // Track whether the user has scrolled away from the top. If they have,
  // we stop auto-following so we don't hijack their reading. Once they
  // scroll back near the top, auto-follow resumes.
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onScroll = () => {
      autoFollowRef.current = c.scrollTop < 60;
    };
    c.addEventListener("scroll", onScroll, { passive: true });
    return () => c.removeEventListener("scroll", onScroll);
  }, []);

  // When a new event lands, scroll the *container only* (never the page) to
  // the newest card. Newest is at the top of our reversed list, so target 0.
  useEffect(() => {
    const c = containerRef.current;
    if (!c || !autoFollowRef.current) return;
    c.scrollTo({ top: 0, behavior: "smooth" });
  }, [transcript.length]);

  const visible = hiddenIds && hiddenIds.size > 0
    ? transcript.filter((e) => !hiddenIds.has(e.id))
    : transcript;
  const reversed = [...visible].reverse();
  const showLive = isStreaming || (!!liveStreamText && currentPhase !== "idle");

  // Only word-by-word animate cards that arrived this session. Old cards
  // restored from localStorage on cold start should appear instantly.
  const sessionStartRef = useRef(Date.now());
  const sessionStart = sessionStartRef.current;

  // Build a display-color lookup so arm_report cards get the same color as
  // their arm on the canvas. Walks committees in the same order as the
  // canvas placement code (see lib/armColors.ts).
  const armColorMap = buildArmColorMap(arms, committees);
  const armColorBySpeaker: Record<string, string> = {};
  for (const a of arms) {
    const c = armColorMap[a.id];
    if (c) {
      armColorBySpeaker[a.name] = c;
      armColorBySpeaker[a.id] = c;
    }
  }

  return (
    <section className="glass-panel" style={{ padding: 0, overflow: "hidden" }}>
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: "rgba(255,255,255,0.45)",
          borderBottom: "1px solid rgba(10,33,56,0.08)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="eyebrow">Tidepool Transcript</span>
          {showLive && (
            <span className="flex items-center gap-1.5 text-[10.5px]" style={{ color: "var(--foam)" }}>
              <span className="living-dot" /> live
            </span>
          )}
        </div>
        <span className="mono text-[10.5px]" style={{ color: "var(--text-mute)" }}>
          {transcript.length} events
        </span>
      </div>

      <div
        ref={containerRef}
        className="overflow-y-auto p-3 space-y-2.5"
        style={{ maxHeight: 460 }}
      >
        {showLive && (
          <LiveStreamCard
            text={liveStreamText}
            phase={currentPhase}
            elapsedMs={elapsedMs}
            charsReceived={charsReceived}
          />
        )}
        <AnimatePresence initial={false}>
          {reversed.map((event, i) => {
            const ts = Date.parse(event.timestamp || "");
            const isNew = !isNaN(ts) && ts >= sessionStart - 1000;
            return (
              <TranscriptCard
                key={event.id}
                event={event}
                index={i}
                armColor={armColorBySpeaker[event.speaker]}
                animate={isNew}
              />
            );
          })}
        </AnimatePresence>
        {transcript.length === 0 && !showLive && (
          <div
            className="py-10 text-center text-[12px] italic"
            style={{ color: "var(--text-mute)" }}
          >
            The tidepool is quiet. Begin growth to hear the arms deliberate.
          </div>
        )}
      </div>
    </section>
  );
}
