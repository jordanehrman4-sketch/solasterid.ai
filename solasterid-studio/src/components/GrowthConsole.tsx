import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  createInitialSolasteridState,
  applyGrowthResult,
  applyUserSeedUpdate,
  type SolasteridState,
} from "../lib/solasteridState";
import { buildGrowthPrompt, shouldInjectFullSeed } from "../lib/promptBuilders";
import { callOpenAIStream } from "../lib/openaiClient";
import type { StreamPhase } from "../lib/openaiClient";
import { parseGrowthResult } from "../lib/modelSchemas";
import { loadSavedState, saveState, clearSavedState } from "../lib/persistence";
import { SeedEditor } from "./SeedEditor";
import { SolasteridCanvas } from "./SolasteridCanvas";
import type { RoundPhase } from "./SolasteridCanvas";
import { TranscriptPanel } from "./TranscriptPanel";
import { AudioControls } from "./AudioControls";
import { ExportPanel } from "./ExportPanel";
import { RoundTimeline } from "./RoundTimeline";
import { ImportArchitecture } from "./ImportArchitecture";
import { MilestoneToast } from "./MilestoneToast";
import { ProgressReef } from "./ProgressReef";
import { AboutSheet } from "./AboutSheet";

const MODELS = [
  { id: "gpt-4.1-mini", label: "gpt-4.1-mini", note: "fast · cheap" },
  { id: "gpt-4.1", label: "gpt-4.1", note: "smart · costly" },
  { id: "gpt-4o-mini", label: "gpt-4o-mini", note: "alt fast" },
  { id: "gpt-4o", label: "gpt-4o", note: "alt smart" },
];

const SPEED_PRESETS = [
  { id: "tide", label: "Tide", icon: "🌊", delay: 3600, blurb: "calm, contemplative" },
  { id: "cruise", label: "Cruise", icon: "🐠", delay: 1200, blurb: "default rhythm" },
  { id: "sprint", label: "Sprint", icon: "🦑", delay: 500, blurb: "burn the seed" },
];

type Props = {
  apiKey: string;
  onClearKey: () => void;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatRelativeSeconds(savedAt: number | null): string {
  if (!savedAt) return "—";
  const s = Math.max(0, Math.round((Date.now() - savedAt) / 1000));
  if (s < 2) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/**
 * Pick what goes in the floating thought bubble during dawn/thinking.
 * - On a seed-injection round (r1, r5, r10, …), show the tempseed itself
 *   — that's literally what the prompt is repeating to the model.
 * - Otherwise, summarize what the creature is chewing on: the most
 *   recent speaker verdict, or the last round summary, or a short
 *   "continuing from r{N}…" placeholder if nothing's happened yet.
 *
 * Always capped at ~24 words to fit the bubble.
 */
function buildThoughtForRound(state: SolasteridState, isSeedRound: boolean): string {
  const cap = 24;
  // The seed can be very long (the full benchmark constitution). Showing 24
  // words of it produced a tall bubble that stretched the canvas frame, so the
  // seed gets a much tighter cap — just enough to recognize it's the seed.
  const seedCap = 14;
  const head = (text: string, words_cap = cap) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    return words.slice(0, words_cap).join(" ") + (words.length > words_cap ? " …" : "");
  };
  if (isSeedRound) {
    return head(state.tempseed, seedCap);
  }
  // Walk recent transcript backwards looking for a meaningful continuation.
  const recent = [...state.transcript].reverse();
  const speaker = recent.find((e) => e.phase === "speaker_decision");
  if (speaker?.content) return head(speaker.content);
  const summary = recent.find((e) => e.phase === "round_summary");
  if (summary?.content) return head(summary.content);
  if (state.round === 0) return head(state.tempseed, seedCap);
  return `Continuing from r${state.round}…`;
}

export function GrowthConsole({ apiKey, onClearKey }: Props) {
  // ── State + restore ───────────────────────────────────────
  const [state, setState] = useState<SolasteridState>(() => {
    const saved = loadSavedState();
    if (saved?.state) return saved.state;
    return createInitialSolasteridState();
  });
  const [restoredRound] = useState<number | null>(() => {
    const saved = loadSavedState();
    return saved?.state && saved.state.round > 0 ? saved.state.round : null;
  });
  const [showRestoredBanner, setShowRestoredBanner] = useState(!!restoredRound);

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roundDelay, setRoundDelay] = useState(1200);
  const [selectedModel, setSelectedModel] = useState("gpt-4.1-mini");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Streaming state
  const [phase, setPhase] = useState<StreamPhase>("idle");
  const [liveStreamText, setLiveStreamText] = useState("");
  const [charsReceived, setCharsReceived] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const requestStartRef = useRef<number>(0);
  const tickerRef = useRef<number | null>(null);

  // Per-arm speech bubbles
  const [armBubbles, setArmBubbles] = useState<
    Record<string, { text: string; tone: "thinking" | "speaking" }>
  >({});
  const bubbleTimerRef = useRef<number | null>(null);

  // Round playback timeline state
  const [roundPhase, setRoundPhase] = useState<RoundPhase>("idle");
  const [activeCommitteeName, setActiveCommitteeName] = useState<string | null>(null);
  const [seedThoughtText, setSeedThoughtText] = useState<string | null>(null);
  const [speakerSpeechText, setSpeakerSpeechText] = useState<string | null>(null);
  const [hiddenTranscriptIds, setHiddenTranscriptIds] = useState<Set<string>>(new Set());

  // Persistence: throttled save + UI indicator
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(() => loadSavedState()?.savedAt ?? null);
  const [, setSavedTick] = useState(0); // forces the "Xs ago" label to refresh

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Elapsed-time ticker only while a round is in flight
  useEffect(() => {
    if (phase === "idle" || phase === "error" || phase === "cooldown") {
      if (tickerRef.current) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
      return;
    }
    if (tickerRef.current) return;
    tickerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - requestStartRef.current);
    }, 100);
    return () => {
      if (tickerRef.current) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    };
  }, [phase]);

  // Autosave to localStorage. Debounced so we don't write on every keystroke.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const ts = saveState(state);
      if (ts) setLastSavedAt(ts);
    }, 800);
    return () => window.clearTimeout(timeoutId);
  }, [state]);

  // Tick once a second so the "saved Xs ago" label updates smoothly.
  useEffect(() => {
    const id = window.setInterval(() => setSavedTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const runOneRound = useCallback(async () => {
    const current = stateRef.current;
    setPhase("building_prompt");
    setLiveStreamText("");
    setCharsReceived(0);
    setElapsedMs(0);
    requestStartRef.current = Date.now();
    setHiddenTranscriptIds(new Set());

    // ── Dawn: the water brightens, a thought appears ──
    setRoundPhase("dawn");
    const nextRound = current.round + 1;
    const isSeedRound = shouldInjectFullSeed(nextRound);
    const thoughtText = buildThoughtForRound(current, isSeedRound);
    setSeedThoughtText(thoughtText);

    // Sample thinking bubbles on up to 8 arms
    const activeArms = current.arms.filter((a) => a.status === "active");
    const MAX_THINKING = 8;
    const stride = Math.max(1, Math.floor(activeArms.length / MAX_THINKING));
    const thinkingBubbles: Record<string, { text: string; tone: "thinking" | "speaking" }> = {};
    for (let i = 0; i < activeArms.length; i += stride) {
      thinkingBubbles[activeArms[i].id] = { text: "…", tone: "thinking" };
      if (Object.keys(thinkingBubbles).length >= MAX_THINKING) break;
    }
    setArmBubbles(thinkingBubbles);

    // brief dawn breath before we hit the API
    await delay(900);

    const prevTranscriptLen = current.transcript.length;
    const prompt = buildGrowthPrompt(current);

    // ── Thinking: water continues brightening as the model streams ──
    const raw = await callOpenAIStream({
      apiKey,
      prompt,
      model: selectedModel,
      onPhase: (p) => {
        setPhase(p);
        if (p === "streaming") setRoundPhase("thinking");
      },
      onDelta: (_chunk, accumulated) => {
        setLiveStreamText(accumulated);
        setCharsReceived(accumulated.length);
      },
    });

    setPhase("parsing");
    const parsed = parseGrowthResult(raw);
    setPhase("applying");

    // Apply state — but we'll hide the new transcript events until playback reveals them.
    let updatedState: SolasteridState = current;
    setState((prev) => {
      updatedState = applyGrowthResult(prev, parsed);
      return updatedState;
    });
    await delay(60); // let state settle so updatedState reflects the new transcript

    // Correlate new transcript events
    const newEvents = updatedState.transcript.slice(prevTranscriptLen);
    const allNewIds = new Set(newEvents.map((e) => e.id));
    setHiddenTranscriptIds(allNewIds);

    const armReportByArmId = new Map<string, string>(); // armId → eventId
    let speakerEventId: string | null = null;
    let summaryEventId: string | null = null;
    for (const ev of newEvents) {
      if (ev.phase === "round_summary") summaryEventId = ev.id;
      else if (ev.phase === "speaker_decision") speakerEventId = ev.id;
      else if (ev.phase === "arm_report") {
        const matched = updatedState.arms.find(
          (a) => a.name === ev.speaker || a.id === ev.speaker,
        );
        if (matched) armReportByArmId.set(matched.id, ev.id);
      }
    }

    // Clear thinking bubbles + seed thought
    setArmBubbles({});

    // ── Committee playback ────────────────────────────────────
    setRoundPhase("committee");

    // Reveal the round summary first (no committee banner yet)
    if (summaryEventId) {
      revealEvent(summaryEventId);
      await delay(1200);
    }

    // Group reporting arms by their first committee
    const armsByCommittee = new Map<string, string[]>();
    for (const armId of armReportByArmId.keys()) {
      const arm = updatedState.arms.find((a) => a.id === armId);
      const cid = arm?.committeeIds[0] ?? "__none";
      if (!armsByCommittee.has(cid)) armsByCommittee.set(cid, []);
      armsByCommittee.get(cid)!.push(armId);
    }

    // Iterate committees in canvas order
    const orderedCommitteeIds = [
      ...[...updatedState.committees]
        .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0) || a.id.localeCompare(b.id))
        .map((c) => c.id),
      "__none",
    ].filter((cid) => armsByCommittee.has(cid));

    const reportsMap = new Map(
      parsed.arm_reports.map((r) => [r.arm_id, r] as const),
    );

    for (const cid of orderedCommitteeIds) {
      const comm = updatedState.committees.find((c) => c.id === cid);
      const commName = comm?.name ?? (cid === "__none" ? "Unassigned Arms" : cid);
      const armsInComm = armsByCommittee.get(cid) ?? [];

      setActiveCommitteeName(commName);
      // hide the seed thought once committees start so the banner has room
      setSeedThoughtText(null);

      // Set speaking bubbles for THIS committee only — first 20 words.
      const bubbles: Record<string, { text: string; tone: "thinking" | "speaking" }> = {};
      for (const armId of armsInComm) {
        const report = reportsMap.get(armId);
        if (!report) continue;
        const txt = (report.quote || report.recommendation || "").trim();
        const words = txt.split(/\s+/).filter(Boolean);
        const headTxt = words.slice(0, 20).join(" ");
        const display = headTxt + (words.length > 20 ? " …" : "");
        bubbles[armId] = { text: display, tone: "speaking" };
      }
      setArmBubbles(bubbles);

      // Give the banner + bubbles a moment to land, then reveal each card.
      await delay(700);
      for (const armId of armsInComm) {
        const eventId = armReportByArmId.get(armId);
        if (!eventId) continue;
        revealEvent(eventId);
        await delay(900);
      }

      // hold the committee on screen a moment before moving on
      await delay(700);
      setArmBubbles({});
    }

    setActiveCommitteeName(null);
    setSeedThoughtText(null);

    // ── Sun: the speakerbot speaks ────────────────────────────
    setRoundPhase("sun");
    // Surface the speaker's verdict as a speech bubble on the creature (capped
    // so it stays compact). This mirrors the thought bubble that opened the
    // round — the resolution the user was previously only seeing in the
    // transcript panel.
    {
      const verdict = (parsed.speaker_decision?.content ?? "").trim();
      const words = verdict.split(/\s+/).filter(Boolean);
      const headTxt = words.slice(0, 32).join(" ");
      setSpeakerSpeechText(headTxt ? headTxt + (words.length > 32 ? " …" : "") : null);
    }
    await delay(700);
    if (speakerEventId) {
      revealEvent(speakerEventId);
      await delay(2200);
    } else {
      await delay(1200);
    }

    // ── Dusk: water dims back ─────────────────────────────────
    setRoundPhase("dusk");
    setPhase("cooldown");
    setSpeakerSpeechText(null);
    await delay(900);

    // Defensive: ensure nothing remains hidden if playback drifted.
    setHiddenTranscriptIds(new Set());
    setLiveStreamText("");
    setRoundPhase("idle");
    setPhase("idle");
  }, [apiKey, selectedModel]);

  // Helper used inside runOneRound's closure — defined here so the closure
  // captures the latest setter reference.
  function revealEvent(id: string) {
    setHiddenTranscriptIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // Autonomous loop
  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;

    async function loop() {
      while (!cancelled) {
        try {
          setError(null);
          await runOneRound();
          if (cancelled) break;
          await delay(roundDelay);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
            setPhase("error");
            setRoundPhase("idle");
            setActiveCommitteeName(null);
            setSeedThoughtText(null);
            setSpeakerSpeechText(null);
            setArmBubbles({});
            setHiddenTranscriptIds(new Set());
            setIsRunning(false);
          }
          break;
        }
      }
    }

    loop();
    return () => {
      cancelled = true;
    };
  }, [isRunning, runOneRound, roundDelay]);

  // Single step
  async function handleStep() {
    if (isRunning || phase !== "idle") return;
    try {
      setError(null);
      await runOneRound();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
      setRoundPhase("idle");
      setActiveCommitteeName(null);
      setSeedThoughtText(null);
      setSpeakerSpeechText(null);
      setArmBubbles({});
      setHiddenTranscriptIds(new Set());
    }
  }

  function handleSeedApply(nextSeed: string) {
    setState((prev) => applyUserSeedUpdate(prev, nextSeed));
  }

  function handleImport(importedState: SolasteridState) {
    setIsRunning(false);
    setState(importedState);
    setError(null);
  }

  function handleReset() {
    if (!confirm("Reset to a fresh 5-arm state? Export first if you want to keep this creature.")) return;
    setState(createInitialSolasteridState());
    setIsRunning(false);
    setError(null);
    setPhase("idle");
    setRoundPhase("idle");
    setActiveCommitteeName(null);
    setSeedThoughtText(null);
    setSpeakerSpeechText(null);
    setLiveStreamText("");
    setArmBubbles({});
    setHiddenTranscriptIds(new Set());
    clearSavedState();
    setLastSavedAt(null);
    setShowRestoredBanner(false);
    if (bubbleTimerRef.current) window.clearTimeout(bubbleTimerRef.current);
  }

  const activeCount = state.arms.filter((a) => a.status === "active").length;
  const retiredCount = state.arms.filter((a) => a.status === "retired").length;
  // Live raw-stream card only shows while the model is actually streaming.
  // Once we move to parsing/committee playback the queued word-by-word
  // reveal in the transcript becomes the show.
  const isStreaming =
    phase === "streaming" ||
    phase === "waiting" ||
    phase === "sending" ||
    phase === "building_prompt";
  // …but we still want the header "autopilot is in flight" chip to be true
  // throughout a round, not just during raw streaming.
  const inRound = phase !== "idle" && phase !== "error";

  return (
    <div className="min-h-screen">
      {/* Milestone toasts */}
      <MilestoneToast activeArmCount={activeCount} />

      {/* Top bar */}
      <header
        className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3"
        style={{
          background: "rgba(255,255,255,0.62)",
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          borderColor: "rgba(10,33,56,0.10)",
        }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-3">
            <span
              className="inline-block rounded-full"
              style={{
                width: 10,
                height: 10,
                background:
                  "radial-gradient(circle at 30% 30%, #2E7F8A, #19314A 60%, #0E2A48)",
              }}
            />
            <h1
              className="font-display font-semibold text-[15px] tracking-tight"
              style={{ color: "var(--text-strong)" }}
            >
              Solasterid Studio
            </h1>
            <span
              className="hidden md:inline text-[11px] cursor-help"
              style={{ color: "var(--text-mute)" }}
              title="Solasteridae /ˌsoʊləˈstɛrɪdiː/ — the sun-star family. 8–16 arms, more than the classical 5-pointed starfish."
            >
              fam. <em>Solasteridae</em> · sun stars
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] mono"
            style={{ color: "var(--text-soft)" }}>
            <span className="chip">
              <span className="chip-dot" /> r{state.round}
            </span>
            <span className="chip">
              <span className="chip-dot" style={{ background: "#2E7F8A" }} />
              {activeCount} active
            </span>
            {retiredCount > 0 && (
              <span className="chip">
                <span className="chip-dot" style={{ background: "#6D8696" }} />
                {retiredCount} fossil
              </span>
            )}
            <span className="chip">
              <span className="chip-dot" style={{ background: "#B23E5C" }} />
              {state.committees.length} committees
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {inRound && (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.3, repeat: Infinity }}
              className="flex items-center gap-2 text-[11px] font-display"
              style={{ color: "var(--foam)" }}
            >
              <span className="living-dot" />
              <span>{phase.replace(/_/g, " ")}</span>
            </motion.div>
          )}
          <span
            className="hidden md:inline-flex items-center gap-1.5 chip"
            title={lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : "no save yet"}
          >
            <span
              className="chip-dot"
              style={{ background: lastSavedAt ? "#2E7F8A" : "#6D8696" }}
            />
            saved {formatRelativeSeconds(lastSavedAt)}
          </span>
          <button
            onClick={() => setAboutOpen(true)}
            className="btn btn-ghost"
            title="About Solasterid Studio"
          >
            ℹ about
          </button>
          <button onClick={handleReset} className="btn btn-ghost">reset</button>
          <button onClick={onClearKey} className="btn btn-ghost">clear key</button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-5">
        {/* Welcome-back banner — only shown when a saved state was restored */}
        <AnimatePresence>
          {showRestoredBanner && restoredRound && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-4 glass-panel flex flex-wrap items-center justify-between gap-3"
              style={{
                padding: "10px 14px",
                borderColor: "rgba(10,33,56,0.20)",
                background: "rgba(10,33,56,0.05)",
              }}
            >
              <div className="flex items-center gap-2 text-[12.5px]">
                <span className="living-dot" />
                <span style={{ color: "var(--text)" }}>
                  Welcome back — your{" "}
                  <span className="mono" style={{ color: "var(--foam)" }}>
                    r{restoredRound}
                  </span>{" "}
                  Solasterid is right where you left it.
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowRestoredBanner(false)} className="btn btn-ghost">
                  keep it
                </button>
                <button
                  onClick={() => {
                    if (confirm("Discard the saved creature and start fresh?")) handleReset();
                  }}
                  className="btn btn-ghost"
                  style={{ color: "var(--coral)" }}
                >
                  start fresh
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Growth controls */}
            <section className="glass-panel" style={{ padding: 16 }}>
              <div className="flex items-baseline justify-between">
                <div className="eyebrow">Growth Console</div>
                <div className="text-[10.5px] mono" style={{ color: "var(--text-mute)" }}>
                  {selectedModel}
                </div>
              </div>

              {/* Run / Pause */}
              <div className="mt-3 flex gap-2">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 1 }}
                  onClick={() => setIsRunning(true)}
                  disabled={isRunning}
                  className="btn btn-primary flex-1"
                >
                  ◉ Begin Growth
                </motion.button>
                <motion.button
                  whileTap={{ y: 1 }}
                  onClick={() => setIsRunning(false)}
                  disabled={!isRunning}
                  className="btn flex-1"
                >
                  Pause
                </motion.button>
              </div>

              <motion.button
                whileTap={{ y: 1 }}
                onClick={handleStep}
                disabled={isRunning || phase !== "idle"}
                className="btn btn-ghost mt-2 w-full"
              >
                step one round →
              </motion.button>

              {/* Stats grid */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "round", value: state.round, color: "var(--cyan)" },
                  { label: "active", value: activeCount, color: "var(--foam)" },
                  { label: "committees", value: state.committees.length, color: "var(--tangerine)" },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="py-2 px-1"
                    style={{
                      background: "rgba(255,255,255,0.55)",
                      border: "1px solid rgba(10,33,56,0.06)",
                      borderRadius: 14,
                    }}
                  >
                    <div
                      className="font-display font-semibold text-[18px] mono"
                      style={{ color }}
                    >
                      {value}
                    </div>
                    <div className="eyebrow" style={{ fontSize: 9 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="mt-3 text-[10.5px] eyebrow hover:text-[var(--text)]"
                style={{ color: "var(--text-mute)" }}
              >
                {showAdvanced ? "▴ hide advanced" : "▾ advanced"}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-3 pt-3" style={{ borderTop: "1px solid rgba(10,33,56,0.08)" }}>
                      {/* Speed presets */}
                      <div>
                        <div className="mb-1.5 flex justify-between text-[10.5px]" style={{ color: "var(--text-soft)" }}>
                          <span className="eyebrow">cadence</span>
                          <span className="mono" style={{ color: "var(--text)" }}>
                            {(roundDelay / 1000).toFixed(1)}s
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {SPEED_PRESETS.map((p) => {
                            const sel = roundDelay === p.delay;
                            return (
                              <button
                                key={p.id}
                                onClick={() => setRoundDelay(p.delay)}
                                className="rounded-xl px-2 py-2 text-center transition-all"
                                style={{
                                  border: `1px solid ${sel ? "rgba(143,255,230,0.4)" : "rgba(10,33,56,0.08)"}`,
                                  background: sel ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.55)",
                                }}
                                title={p.blurb}
                              >
                                <div className="text-[14px]">{p.icon}</div>
                                <div
                                  className="font-display text-[11px] font-semibold"
                                  style={{ color: sel ? "var(--foam)" : "var(--text)" }}
                                >
                                  {p.label}
                                </div>
                                <div className="text-[9.5px] mono" style={{ color: "var(--text-mute)" }}>
                                  {(p.delay / 1000).toFixed(1)}s
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="range" min="200" max="8000" step="100"
                          value={roundDelay}
                          onChange={(e) => setRoundDelay(Number(e.target.value))}
                          className="mt-2"
                        />
                      </div>

                      {/* Model selector */}
                      <div>
                        <div className="mb-1.5 eyebrow">model</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {MODELS.map((m) => {
                            const sel = selectedModel === m.id;
                            return (
                              <button
                                key={m.id}
                                onClick={() => setSelectedModel(m.id)}
                                className="rounded-xl px-2 py-1.5 text-left transition-all"
                                style={{
                                  border: `1px solid ${sel ? "rgba(143,255,230,0.4)" : "rgba(10,33,56,0.08)"}`,
                                  background: sel ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.55)",
                                }}
                              >
                                <div
                                  className="text-[11px] font-display font-semibold"
                                  style={{ color: sel ? "var(--foam)" : "var(--text)" }}
                                >
                                  {m.label}
                                </div>
                                <div className="text-[9.5px]" style={{ color: "var(--text-mute)" }}>
                                  {m.note}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="mt-3 text-[10.5px] leading-relaxed" style={{ color: "var(--text-mute)" }}>
                The run never pauses for seed checkpoints. Every 5 rounds, tempseed is
                injected automatically.
              </p>
            </section>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="glass-panel glass-panel--coral"
                  style={{ padding: 14 }}
                >
                  <div className="eyebrow" style={{ color: "var(--coral)" }}>
                    Error — run paused
                  </div>
                  <div className="mt-1 text-[11.5px]" style={{ color: "var(--text)" }}>
                    {error}
                  </div>
                  <button
                    onClick={() => {
                      setError(null);
                      setPhase("idle");
                      setIsRunning(true);
                    }}
                    className="btn btn-ghost mt-2"
                    style={{ color: "var(--coral)" }}
                  >
                    retry
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <ImportArchitecture onImport={handleImport} />
            <SeedEditor tempseed={state.tempseed} round={state.round} onApply={handleSeedApply} />
            <AudioControls state={state} />
            <RoundTimeline state={state} />
            <ExportPanel state={state} />
          </aside>

          {/* Main panel */}
          <main className="space-y-4">
            <ProgressReef state={state} />
            <SolasteridCanvas
              state={state}
              armBubbles={armBubbles}
              autopilot={isRunning}
              isStreaming={isStreaming}
              roundPhase={roundPhase}
              activeCommitteeName={activeCommitteeName}
              seedThoughtText={seedThoughtText}
              speakerSpeechText={speakerSpeechText}
            />
            <TranscriptPanel
              transcript={state.transcript}
              arms={state.arms}
              committees={state.committees}
              hiddenIds={hiddenTranscriptIds}
              liveStreamText={liveStreamText}
              isStreaming={isStreaming}
              currentPhase={phase}
              elapsedMs={elapsedMs}
              charsReceived={charsReceived}
            />
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="mx-auto max-w-7xl px-4 pb-8 text-[11px]"
        style={{ color: "var(--text-mute)" }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3 pt-4"
          style={{ borderTop: "1px solid rgba(10,33,56,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: "var(--text-soft)" }}>
              <em>Solasterid Studio</em> — grow a many-armed creature, take it home at r50.
            </span>
          </div>
          <div className="flex items-center gap-3" style={{ color: "var(--text-mute)" }}>
            <span title="Solasteridae /ˌsoʊləˈstɛrɪdiː/ — the sun-star family of sea stars. 8–16 arms.">
              fam. <em>Solasteridae</em>
            </span>
            <span>·</span>
            <span className="mono">
              key in RAM · creature in localStorage · fossils in IndexedDB
            </span>
          </div>
        </div>
      </footer>

      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
