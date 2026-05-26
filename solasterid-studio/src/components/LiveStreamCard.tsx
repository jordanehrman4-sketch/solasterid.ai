import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { StreamPhase } from "../lib/openaiClient";

type Props = {
  text: string;
  phase: StreamPhase;
  elapsedMs: number;
  charsReceived: number;
};

const PHASE_LABELS: Record<StreamPhase, string> = {
  idle: "idle",
  building_prompt: "building prompt",
  sending: "calling the speakerbot",
  waiting: "listening for first signal",
  streaming: "transcribing the deliberation",
  parsing: "parsing structure",
  applying: "applying mutations",
  cooldown: "settling",
  error: "error",
};

const PHASE_PROGRESS: Record<StreamPhase, number> = {
  idle: 0,
  building_prompt: 8,
  sending: 18,
  waiting: 30,
  streaming: 70,
  parsing: 85,
  applying: 95,
  cooldown: 100,
  error: 100,
};

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;
}

export function LiveStreamCard({ text, phase, elapsedMs, charsReceived }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const autoFollow = useRef(true);

  // Track whether the user has scrolled away
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 32;
      autoFollow.current = nearBottom;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !autoFollow.current) return;
    el.scrollTop = el.scrollHeight;
  }, [text]);

  const progress = PHASE_PROGRESS[phase];
  const indeterminate = phase === "waiting" || phase === "sending";

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass-panel glass-panel--cyan"
      style={{ padding: 16, position: "relative", overflow: "hidden" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="living-dot" />
          <span className="eyebrow">Live Deliberation</span>
          <span
            className="text-[11px] font-display"
            style={{ color: "var(--text)" }}
          >
            {PHASE_LABELS[phase]}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10.5px] mono text-[var(--text-mute)]">
          <span>{formatElapsed(elapsedMs)}</span>
          {charsReceived > 0 && <span>{charsReceived.toLocaleString()} chars</span>}
        </div>
      </div>

      {/* Phase progress bar */}
      <div className="mt-3 progress-track">
        {indeterminate ? (
          <div className="progress-indeterminate absolute inset-0" />
        ) : (
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        )}
      </div>

      {/* Streamed text */}
      <div
        ref={scrollerRef}
        className="mt-3 rounded-xl"
        style={{
          maxHeight: 220,
          overflowY: "auto",
          padding: "10px 12px",
          background: "rgba(7, 21, 35, 0.55)",
          border: "1px solid rgba(10,33,56,0.08)",
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
          fontSize: 11.5,
          lineHeight: 1.62,
          color: "var(--text)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {text ? (
          <span className="stream-caret">{text}</span>
        ) : (
          <span style={{ color: "var(--text-mute)", fontStyle: "italic" }}>
            …
          </span>
        )}
      </div>
    </motion.article>
  );
}
