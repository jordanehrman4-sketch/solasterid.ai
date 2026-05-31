import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useEffect, useRef, useState } from "react";
import type {
  SolasteridState,
  SolasteridArm,
  SolasteridCommittee,
} from "../lib/solasteridState";
import { ArmDetailPanel } from "./ArmDetailPanel";
import { ReefBackground } from "./ReefBackground";
import { organicArmPath, type Point } from "../lib/organicGeometry";

type ArmBubble = { text: string; tone: "thinking" | "speaking" };

export type RoundPhase =
  | "idle"
  | "dawn"
  | "thinking"
  | "committee"
  | "sun"
  | "dusk";

type Props = {
  state: SolasteridState;
  /** Map of armId → bubble content. Shown as little chat bubbles near each arm. */
  armBubbles?: Record<string, ArmBubble>;
  /** Whether the creature is on autonomous growth (autopilot). */
  autopilot?: boolean;
  /** Whether a model call is currently active. */
  isStreaming?: boolean;
  /** Current round-playback phase, drives brightness + sun + banner. */
  roundPhase?: RoundPhase;
  /** When set, shows a committee-name banner above the creature. */
  activeCommitteeName?: string | null;
  /** When set, shows a thought bubble above the creature with the seed. */
  seedThoughtText?: string | null;
  /** When set (during the 'sun' phase), shows the speakerbot's verdict as a
   *  speech bubble emerging from the creature — the resolution of the round. */
  speakerSpeechText?: string | null;
};

const PHASE_BRIGHTNESS: Record<RoundPhase, number> = {
  idle: 0.08,
  dawn: 0.32,
  thinking: 0.52,
  committee: 0.68,
  sun: 0.92,
  dusk: 0.28,
};

/* ─── Pastel palette ─────────────────────────────────────────
   Shared with the transcript via src/lib/armColors.ts so the
   per-arm color dot prefix on report cards matches the canvas.
   ──────────────────────────────────────────────────────────── */
import { paletteFor } from "../lib/armColors";

type Bubble = {
  id: number;
  x: number;
  size: number;
  delay: number;
  duration: number;
};

function useBubbles(count = 26) {
  return useMemo<Bubble[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: 3 + Math.random() * 94,
        size: 3 + Math.random() * 9,
        delay: Math.random() * 10,
        duration: 9 + Math.random() * 11,
      })),
    [count],
  );
}

/* ─── Placement ──────────────────────────────────────────── */

type ArmPlacement = {
  arm: SolasteridArm;
  angle: number;
  length: number;
  baseWidth: number;
  baseRadius: number;
  committee?: SolasteridCommittee;
  geometry: ReturnType<typeof organicArmPath>;
  displayColor: string;
};

function placeArms(
  arms: SolasteridArm[],
  committees: SolasteridCommittee[],
  cx: number,
  cy: number,
  bodyRadius: number,
  maxArmLength: number,
): {
  active: ArmPlacement[];
  retired: ArmPlacement[];
  probation: ArmPlacement[];
  sectors: Array<{
    cid: string;
    start: number;
    end: number;
    color: string;
    name: string;
  }>;
} {
  const active = arms.filter((a) => a.status === "active");
  const retired = arms.filter((a) => a.status === "retired");
  const probation = arms.filter((a) => a.status === "probation");

  const sortedComms = [...committees].sort(
    (a, b) => (a.layer ?? 0) - (b.layer ?? 0) || a.id.localeCompare(b.id),
  );
  const groups: Record<string, SolasteridArm[]> = {};
  for (const arm of active) {
    const cid = arm.committeeIds[0] ?? "__none";
    (groups[cid] ??= []).push(arm);
  }
  const orderedKeys = [
    ...sortedComms.map((c) => c.id).filter((k) => groups[k]?.length),
    ...(groups["__none"]?.length ? ["__none"] : []),
  ];
  if (orderedKeys.length === 0 && active.length) orderedKeys.push("__none");

  const total = active.length || 1;
  const sectors: Array<{
    cid: string;
    start: number;
    end: number;
    color: string;
    name: string;
  }> = [];

  let cursor = -Math.PI / 2;
  const activePlacements: ArmPlacement[] = [];
  let displayIdx = 0;

  for (const cid of orderedKeys) {
    const list = groups[cid] ?? [];
    const span = (list.length / total) * Math.PI * 2;
    const comm = committees.find((c) => c.id === cid);
    sectors.push({
      cid,
      start: cursor,
      end: cursor + span,
      color: comm?.color ?? "#64F5E6",
      name: comm?.name ?? "",
    });

    list.forEach((arm, i) => {
      const denom = list.length === 1 ? 2 : list.length + 1;
      const t = list.length === 1 ? 0.5 : (i + 1) / denom;
      const angle = cursor + t * span;
      const jitter = Math.sin(i * 1.7 + cursor) * (span / (list.length + 2)) * 0.18;
      const finalAngle = angle + jitter;
      const len = maxArmLength * (0.84 + ((Math.cos(i * 2.13 + cursor) + 1) / 2) * 0.18);
      const curvature = Math.sin(finalAngle * 2.4 + i * 0.7) * 0.45;
      const baseWidth = 24 + Math.sin(i + cursor) * 3;
      const displayColor = paletteFor(displayIdx, arm.color);
      const geo = organicArmPath({
        cx,
        cy,
        angle: finalAngle,
        baseRadius: bodyRadius - 6,
        length: len,
        curvature,
        baseWidth,
        tipWidth: 2.4,
      });
      activePlacements.push({
        arm,
        angle: finalAngle,
        length: len,
        baseWidth,
        baseRadius: bodyRadius - 6,
        committee: comm,
        geometry: geo,
        displayColor,
      });
      displayIdx++;
    });
    cursor += span;
  }

  // Probation arms hover halfway out
  const probationPlacements: ArmPlacement[] = probation.map((arm, i) => {
    const angle = (i / Math.max(1, probation.length)) * Math.PI * 2 - Math.PI / 4 + 0.4;
    const len = maxArmLength * 0.55;
    const geo = organicArmPath({
      cx,
      cy,
      angle,
      baseRadius: bodyRadius - 4,
      length: len,
      curvature: Math.sin(angle * 3.3) * 0.7,
      baseWidth: 16,
      tipWidth: 2,
    });
    return {
      arm,
      angle,
      length: len,
      baseWidth: 16,
      baseRadius: bodyRadius - 4,
      geometry: geo,
      displayColor: "#C8B0E8",
    };
  });

  // Retired = fossil fragments inside body
  const retiredPlacements: ArmPlacement[] = retired.map((arm, i) => {
    const angle = (i / Math.max(1, retired.length)) * Math.PI * 2 - Math.PI / 2 + 0.15;
    const len = bodyRadius * 0.55;
    const geo = organicArmPath({
      cx,
      cy,
      angle,
      baseRadius: 6,
      length: len,
      curvature: Math.sin(angle * 4.2) * 0.4,
      baseWidth: 9,
      tipWidth: 1.4,
    });
    return {
      arm,
      angle,
      length: len,
      baseWidth: 9,
      baseRadius: 6,
      geometry: geo,
      displayColor: "#6B5A50",
    };
  });

  return {
    active: activePlacements,
    retired: retiredPlacements,
    probation: probationPlacements,
    sectors,
  };
}

/* ─── Sucker ridge along an arm ────────────────────────── */
function SuckerRidge({
  geometry,
  count,
  color,
}: {
  geometry: ArmPlacement["geometry"];
  count: number;
  color: string;
}) {
  const { p0, p1, p2 } = geometry;
  const dots: Point[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const it = 1 - t;
    dots.push({
      x: it * it * p0.x + 2 * it * t * p1.x + t * t * p2.x,
      y: it * it * p0.y + 2 * it * t * p1.y + t * t * p2.y,
    });
  }
  return (
    <g>
      {dots.map((d, i) => {
        const taper = 1 - (i + 1) / (count + 1);
        return (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={1.4 + taper * 0.9}
            fill={color}
            opacity={0.55}
          />
        );
      })}
    </g>
  );
}

/* ─── Center creature (terracotta body + papulae ring + mouth) ─── */
function CenterCreature({
  cx,
  cy,
  radius,
  pulsing,
  isStreaming,
}: {
  cx: number;
  cy: number;
  radius: number;
  pulsing: boolean;
  isStreaming: boolean;
}) {
  // Papulae dots ringing the body
  const papulae = useMemo(() => {
    const arr: Array<{ x: number; y: number; r: number; tint: string }> = [];
    const count = 26;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const wobble = (i % 3) - 1; // -1, 0, 1
      const rr = radius * 0.88 + wobble * 1.2;
      arr.push({
        x: cx + Math.cos(a) * rr,
        y: cy + Math.sin(a) * rr,
        r: 1.6 + (i % 2 === 0 ? 0.4 : 0),
        tint: i % 5 === 0 ? "#FFE6A3" : "#FFC788",
      });
    }
    return arr;
  }, [cx, cy, radius]);

  return (
    <g>
      {/* Big soft teal halo behind body */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={radius * 3.8}
        fill="url(#bodyAura)"
        animate={{
          opacity: pulsing ? [0.55, 0.85, 0.55] : [0.32, 0.5, 0.32],
          scale: [1, 1.03, 1],
        }}
        transition={{
          duration: pulsing ? 1.1 : 5.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={radius * 2.5}
        fill="url(#bodyAuraInner)"
        animate={{ opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Body — terracotta disc */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="url(#bodyTerracotta)"
        stroke="#5A2A1A"
        strokeWidth={1.2}
      />
      {/* Inner shadow ring */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={2}
        opacity={0.5}
        style={{ filter: "blur(2px)" }}
      />
      {/* Highlight (top-left sheen) */}
      <ellipse
        cx={cx - radius * 0.35}
        cy={cy - radius * 0.4}
        rx={radius * 0.45}
        ry={radius * 0.28}
        fill="rgba(255,220,180,0.18)"
      />

      {/* Papulae dots */}
      {papulae.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.tint} opacity={0.9} />
      ))}

      {/* Black mouth */}
      <circle
        cx={cx}
        cy={cy}
        r={radius * 0.22}
        fill="#0A0608"
        stroke="rgba(0,0,0,0.8)"
        strokeWidth={0.5}
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={radius * 0.22}
        fill="url(#mouthShine)"
        animate={{
          r: isStreaming
            ? [radius * 0.2, radius * 0.27, radius * 0.2]
            : [radius * 0.21, radius * 0.24, radius * 0.21],
        }}
        transition={{
          duration: isStreaming ? 1.6 : 3.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {/* Tiny inner reflection in mouth */}
      <circle
        cx={cx - radius * 0.06}
        cy={cy - radius * 0.06}
        r={radius * 0.04}
        fill="#FFFFFF"
        opacity={0.4}
      />
    </g>
  );
}


/* ─── Speech bubble at an arm tip ──────────────────── */
function SpeechBubble({
  x,
  y,
  text,
  tone,
  delay,
}: {
  x: number;
  y: number;
  text: string;
  tone: "thinking" | "speaking";
  delay: number;
}) {
  // Legacy in-SVG variant kept for back-compat. We render an HTML overlay
  // (SpeechBubbleLayer below) instead so kelp / SVG viewBox can't clip it.
  void x; void y; void text; void tone; void delay;
  return null;
}

/**
 * HTML overlay that draws a speech bubble per active arm using
 * percentage-based positioning. Because it's outside the SVG, it sits on top
 * of all reef decoration and is bound only by the canvas frame.
 */
function SpeechBubbleLayer({
  active,
  armBubbles,
  cx,
  cy,
  svgSize,
  swayDeg,
}: {
  active: ArmPlacement[];
  armBubbles: Record<string, ArmBubble>;
  cx: number;
  cy: number;
  svgSize: number;
  swayDeg: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 6 }}>
      <AnimatePresence>
        {active.map((p, i) => {
          const bub = armBubbles[p.arm.id];
          if (!bub) return null;
          // Re-apply the parent's gentle sway to the tip coordinates so the
          // bubble's tail still aligns with the arm.
          const swayRad = (swayDeg * Math.PI) / 180;
          const cosS = Math.cos(swayRad);
          const sinS = Math.sin(swayRad);
          const dx = p.geometry.tip.x - cx;
          const dy = p.geometry.tip.y - cy;
          const tipX = cx + dx * cosS - dy * sinS;
          const tipY = cy + dx * sinS + dy * cosS;

          // Convert to viewport percentages of the SVG's square (it preserves
          // aspect ratio, so percentages of width/height of THIS overlay map
          // 1:1 to the SVG's coordinate system because the overlay is sized
          // to the SVG's rendered box via the parent <section>).
          const left = (tipX / svgSize) * 100;
          const top = (tipY / svgSize) * 100;

          const isThinking = bub.tone === "thinking";
          const bubbleW = isThinking ? 64 : 220;

          return (
            <motion.div
              key={"bub-" + p.arm.id}
              initial={{ opacity: 0, scale: 0.7, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -6 }}
              transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.4), ease: [0.2, 0.7, 0.2, 1] }}
              style={{
                position: "absolute",
                left: left + "%",
                top: top + "%",
                transform: "translate(-50%, -100%)",
                marginTop: -8,
                width: bubbleW,
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.97)",
                  border: "1px solid rgba(7,21,35,0.55)",
                  borderRadius: 14,
                  padding: isThinking ? "6px 10px" : "8px 12px",
                  color: "#0A1626",
                  fontFamily: "Space Grotesk, Inter, sans-serif",
                  fontSize: isThinking ? 14 : 12,
                  lineHeight: 1.4,
                  fontWeight: isThinking ? 700 : 500,
                  textAlign: isThinking ? "center" : "left",
                  wordBreak: "break-word",
                  boxShadow: "0 4px 16px rgba(255,255,255,0.55)",
                  position: "relative",
                }}
              >
                {isThinking ? (
                  <span style={{ display: "inline-flex", gap: 3 }}>
                    <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: 999, background: "#0A1626", animation: "speech-dot 1.1s ease-in-out infinite", animationDelay: "0s" }} />
                    <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: 999, background: "#0A1626", animation: "speech-dot 1.1s ease-in-out infinite", animationDelay: "0.18s" }} />
                    <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: 999, background: "#0A1626", animation: "speech-dot 1.1s ease-in-out infinite", animationDelay: "0.36s" }} />
                  </span>
                ) : (
                  bub.text
                )}
                {/* tail */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    bottom: -7,
                    width: 0,
                    height: 0,
                    transform: "translateX(-50%)",
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: "8px solid rgba(255,255,255,0.97)",
                    filter: "drop-shadow(0 1px 0 rgba(7,21,35,0.55))",
                  }}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ─── Arm-name labels as an HTML overlay ──────────────────────
   Previously these lived inside the creature SVG and were pushed onto a
   ring 344px from center — which overflowed the 720px square viewBox at the
   cardinal angles and got clipped (the "labels vanish over the kelp" bug,
   since the kelp sits at those same edges). They also only appeared when
   activeCount <= 8. Rendering them here, with the exact same percentage
   positioning the speech bubbles use, fixes both: they're bound by the canvas
   frame instead of the square SVG, they sit above all reef decoration, and
   they're always visible. */
function LabelLayer({
  active,
  cx,
  cy,
  svgSize,
  swayDeg,
  selectedArmId,
  hoveredArmId,
  hiddenArmIds,
  onArmClick,
  onArmHover,
}: {
  active: ArmPlacement[];
  cx: number;
  cy: number;
  svgSize: number;
  swayDeg: number;
  selectedArmId: string | null;
  hoveredArmId: string | null;
  /** Arms currently showing a speech bubble — skip their label to avoid overlap. */
  hiddenArmIds: Set<string>;
  onArmClick: (armId: string) => void;
  onArmHover: (armId: string | null) => void;
}) {
  const swayRad = (swayDeg * Math.PI) / 180;
  const cosS = Math.cos(swayRad);
  const sinS = Math.sin(swayRad);
  // Nudge the label a little further out than the tip along the arm's angle so
  // it clears the glowing tip, then clamp so it never hugs the frame edge.
  const clamp = (v: number) => Math.max(4, Math.min(96, v));

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }}>
      {active.map((p) => {
        if (hiddenArmIds.has(p.arm.id)) return null;
        const isActiveLabel =
          selectedArmId === p.arm.id || hoveredArmId === p.arm.id;
        // Tip position with sway applied.
        const dx = p.geometry.tip.x - cx;
        const dy = p.geometry.tip.y - cy;
        const tipX = cx + dx * cosS - dy * sinS;
        const tipY = cy + dx * sinS + dy * cosS;
        // Push outward from center a touch so the label sits just past the tip.
        const rotatedAngle = p.angle + swayRad;
        const outX = tipX + Math.cos(rotatedAngle) * 16;
        const outY = tipY + Math.sin(rotatedAngle) * 16;
        const left = clamp((outX / svgSize) * 100);
        const top = clamp((outY / svgSize) * 100);
        return (
          <div
            key={"lbl-" + p.arm.id}
            className="absolute"
            style={{
              left: left + "%",
              top: top + "%",
              transform: "translate(-50%, -50%)",
              whiteSpace: "nowrap",
            }}
          >
            <span
              className="rounded-full font-display"
              role="button"
              tabIndex={0}
              onClick={() => onArmClick(p.arm.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onArmClick(p.arm.id);
                }
              }}
              onMouseEnter={() => onArmHover(p.arm.id)}
              onMouseLeave={() => onArmHover(null)}
              style={{
                display: "inline-block",
                cursor: "pointer",
                pointerEvents: "auto", // the container is click-through; the chip isn't
                padding: isActiveLabel ? "3px 9px" : "2px 8px",
                fontSize: isActiveLabel ? 12 : 11,
                fontWeight: isActiveLabel ? 600 : 500,
                lineHeight: 1.2,
                color: isActiveLabel ? "#FFFFFF" : "#E8F3F1",
                background: "rgba(7,21,35,0.82)",
                border: `1px solid ${p.displayColor}${isActiveLabel ? "" : "AA"}`,
                boxShadow: isActiveLabel
                  ? `0 0 0 1px ${p.displayColor}55, 0 2px 8px rgba(0,0,0,0.35)`
                  : "0 1px 4px rgba(0,0,0,0.3)",
                letterSpacing: "0.01em",
                transition: "all 140ms ease",
              }}
            >
              {p.arm.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Helper: gently swaying transform ──────────────── */
function useGentleSway() {
  // Slow back-and-forth tilt ± 2°. Updates at ~12fps so we don't burn cycles
  // re-rendering the whole canvas — the motion reads smooth at this speed.
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      setT((performance.now() - start) / 1000);
    }, 85);
    return () => window.clearInterval(id);
  }, []);
  return Math.sin((t / 18) * Math.PI * 2) * 2; // degrees
}

/* ─── Main component ─────────────────────────────────── */

export function SolasteridCanvas({
  state,
  armBubbles = {},
  autopilot = false,
  isStreaming = false,
  roundPhase = "idle",
  activeCommitteeName = null,
  seedThoughtText = null,
  speakerSpeechText = null,
}: Props) {
  const svgSize = 720;
  const cx = svgSize / 2;
  const cy = svgSize / 2 - 10;
  const bodyRadius = 56;
  const maxArmLength = 240;

  const bubbles = useBubbles(28);
  const [pulsingCore, setPulsingCore] = useState(false);
  const [selectedArmId, setSelectedArmId] = useState<string | null>(null);
  const [hoveredArmId, setHoveredArmId] = useState<string | null>(null);
  const prevRound = useRef(state.round);

  useEffect(() => {
    if (state.round !== prevRound.current) {
      prevRound.current = state.round;
      setPulsingCore(true);
      const t = setTimeout(() => setPulsingCore(false), 1300);
      return () => clearTimeout(t);
    }
  }, [state.round]);

  const swayDeg = useGentleSway();

  const { active, retired, probation, sectors } = useMemo(
    () => placeArms(state.arms, state.committees, cx, cy, bodyRadius, maxArmLength),
    [state.arms, state.committees, cx, cy, bodyRadius],
  );

  const activeCount = active.length;
  const selectedArm = state.arms.find((a) => a.id === selectedArmId) ?? null;

  function handleArmClick(armId: string) {
    setSelectedArmId((prev) => (prev === armId ? null : armId));
  }

  return (
    <section
      className="relative overflow-hidden aquarium-frame"
      style={{ padding: 0, minHeight: 660 }}
    >
      {/* Background reef */}
      <div className="absolute inset-0" aria-hidden>
        <ReefBackground width={svgSize} height={680} alive />
      </div>

      {/* ── Sunrise / brightness wash ────────────────────
         A full-width band that sweeps across the top of the
         reef during dawn → thinking → committee → sun, then
         fades during dusk → idle. Less "abduction beam,"
         more "the lights are coming on."
         ──────────────────────────────────────────────────── */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: PHASE_BRIGHTNESS[roundPhase] }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
        style={{
          background:
            "linear-gradient(180deg, " +
            "rgba(255,210,164,0.55) 0%, " +
            "rgba(255,180,170,0.32) 14%, " +
            "rgba(200,176,232,0.20) 30%, " +
            "rgba(143,255,230,0.14) 48%, " +
            "rgba(143,255,230,0.04) 66%, " +
            "rgba(0,0,0,0) 86%)",
          mixBlendMode: "screen",
        }}
      />
      {/* Side warmth — a soft pink-orange wash that paints the corners with dawn light */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: Math.max(0, PHASE_BRIGHTNESS[roundPhase] - 0.15) }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(140% 65% at 10% 0%, rgba(255,160,140,0.30), transparent 55%), " +
            "radial-gradient(140% 65% at 90% 0%, rgba(255,205,150,0.30), transparent 55%)",
          mixBlendMode: "screen",
        }}
      />
      {/* Color band at the very top edge — looks like a real horizon */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0"
        style={{
          top: 0,
          height: 160,
          background:
            "linear-gradient(180deg, " +
            "rgba(255,196,150,0.55) 0%, " +
            "rgba(255,150,170,0.32) 30%, " +
            "rgba(180,180,255,0.18) 65%, " +
            "rgba(143,255,230,0.0) 100%)",
        }}
        animate={{ opacity: Math.max(0, PHASE_BRIGHTNESS[roundPhase] - 0.1) }}
        transition={{ duration: 2.2, ease: "easeInOut" }}
      />

      {/* ── Sun (only at speaker time) ────────────────────── */}
      <AnimatePresence>
        {roundPhase === "sun" && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 -translate-x-1/2"
            style={{ top: -40 }}
            initial={{ opacity: 0, y: -30, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.85 }}
            transition={{ duration: 1.4, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 50% 50%, rgba(255,231,176,0.95) 0%, rgba(255,201,168,0.4) 35%, rgba(255,111,145,0) 65%)",
                filter: "blur(6px)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating bubbles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {bubbles.map((b) => (
          <motion.div
            key={b.id}
            className="absolute rounded-full"
            style={{
              left: b.x + "%",
              bottom: "-20px",
              width: b.size,
              height: b.size,
              background:
                "radial-gradient(circle at 30% 30%, rgba(168,255,235,0.55), rgba(168,255,235,0.05) 65%, transparent)",
              boxShadow:
                "inset 0 0 6px rgba(168,255,235,0.3), 0 0 4px rgba(168,255,235,0.22)",
            }}
            animate={{ y: [0, -780], opacity: [0.7, 0] }}
            transition={{
              duration: b.duration,
              delay: b.delay,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Main organism SVG */}
      <svg
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className="relative mx-auto block"
        style={{ width: "100%", maxWidth: svgSize, height: "auto" }}
      >
        <defs>
          {/* Body gradients */}
          <radialGradient id="bodyTerracotta" cx="40%" cy="38%" r="72%">
            <stop offset="0%" stopColor="#C97956" />
            <stop offset="55%" stopColor="#A35234" />
            <stop offset="100%" stopColor="#5E2613" />
          </radialGradient>
          <radialGradient id="mouthShine" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(255,200,140,0.18)" />
            <stop offset="60%" stopColor="rgba(255,200,140,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="bodyAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(143,255,230,0.45)" />
            <stop offset="55%" stopColor="rgba(100,245,230,0.18)" />
            <stop offset="100%" stopColor="rgba(143,255,230,0)" />
          </radialGradient>
          <radialGradient id="bodyAuraInner" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(143,255,230,0)" />
          </radialGradient>

          <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="armShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Gentle whole-creature sway */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${swayDeg}deg)`,
            transition: "transform 200ms linear",
          }}
        >
          {/* Committee grouping glow — a soft radial blob centered on each
              committee's middle angle, out among its arms. Replaces the old
              hard pie-wedge sectors, which formed an unwanted "Pac-Man" shape
              whenever one committee held most of the arms. This reads as
              ambient color grouping with no geometric edges. */}
          {sectors.map((s, i) => {
            if (s.cid === "__none") return null;
            const span = s.end - s.start;
            if (span < 0.05) return null;
            return (
              <radialGradient
                key={`sectorGrad-${i}`}
                id={`committeeGlow-${i}`}
                cx="50%"
                cy="50%"
                r="50%"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
                <stop offset="55%" stopColor={s.color} stopOpacity={0.06} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </radialGradient>
            );
          })}
          {sectors.map((s, i) => {
            if (s.cid === "__none") return null;
            const span = s.end - s.start;
            if (span < 0.05) return null;
            const mid = (s.start + s.end) / 2;
            const glowR = (maxArmLength + bodyRadius) * 0.62;
            const gx = cx + Math.cos(mid) * (bodyRadius + maxArmLength * 0.45);
            const gy = cy + Math.sin(mid) * (bodyRadius + maxArmLength * 0.45);
            return (
              <circle
                key={`sectorGlow-${i}`}
                cx={gx}
                cy={gy}
                r={glowR}
                fill={`url(#committeeGlow-${i})`}
              />
            );
          })}

          {/* Soft drop shadow under each arm */}
          {active.map((p) => (
            <path
              key={"shadow-" + p.arm.id}
              d={p.geometry.ribbon}
              fill="#02080F"
              opacity={0.35}
              filter="url(#armShadow)"
              transform="translate(2,4)"
            />
          ))}

          {/* Active arms — organic pastel ribbons */}
          <AnimatePresence>
            {active.map((p, i) => {
              const { arm, geometry, displayColor } = p;
              const isSelected = selectedArmId === arm.id;
              const isHovered = hoveredArmId === arm.id;
              const isDimmed = selectedArmId && !isSelected;
              return (
                <motion.g
                  key={arm.id}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: isDimmed ? 0.45 : 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.4 }}
                  transition={{ duration: 0.55, delay: i * 0.025 }}
                  style={{ cursor: "pointer", transformOrigin: `${cx}px ${cy}px`, pointerEvents: "all" }}
                  onClick={() => handleArmClick(arm.id)}
                  onMouseEnter={() => setHoveredArmId(arm.id)}
                  onMouseLeave={() => setHoveredArmId(null)}
                >
                  {/* Invisible fat hit-area along the arm's centerline. The
                      visible ribbon tapers to ~3px at the tip, which made it
                      almost impossible to click; this wide stroke gives the
                      whole arm a generous target. NOTE: the stroke must be
                      *painted* to be hittable — a `transparent`/`none` stroke
                      is not captured, so we paint black at 0 opacity. */}
                  <path
                    d={geometry.center}
                    fill="none"
                    stroke="#000"
                    strokeOpacity={0}
                    strokeWidth={34}
                    strokeLinecap="round"
                    pointerEvents="stroke"
                  />
                  {/* Main ribbon body */}
                  <path
                    d={geometry.ribbon}
                    fill={displayColor}
                    opacity={0.95}
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth={0.6}
                    pointerEvents="fill"
                  />
                  {/* Upper highlight along the curve */}
                  <path
                    d={geometry.center}
                    fill="none"
                    stroke="rgba(255,255,255,0.55)"
                    strokeWidth={isSelected ? 1.5 : 1.0}
                    strokeLinecap="round"
                    opacity={0.45}
                  />
                  {/* Sucker ridge dots */}
                  <SuckerRidge geometry={geometry} count={6} color="#4A2418" />
                  {/* Tip glow */}
                  <motion.circle
                    cx={geometry.tip.x}
                    cy={geometry.tip.y}
                    r={isSelected ? 5 : 3.5}
                    fill={displayColor}
                    filter="url(#softGlow)"
                    animate={{
                      r: isSelected ? [5, 6.5, 5] : [3.2, 4.4, 3.2],
                      opacity: [0.75, 1, 0.75],
                    }}
                    transition={{
                      duration: 2.6 + i * 0.1,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <circle
                    cx={geometry.tip.x}
                    cy={geometry.tip.y}
                    r={isSelected ? 2.0 : 1.4}
                    fill="#FFFFFF"
                    opacity={0.85}
                  />
                </motion.g>
              );
            })}
          </AnimatePresence>

          {/* Probation arms — wavering wisps */}
          {probation.map(({ arm, geometry }, i) => (
            <motion.g
              key={arm.id}
              animate={{ opacity: [0.32, 0.7, 0.32] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.35 }}
              style={{ cursor: "pointer", pointerEvents: "all" }}
              onClick={() => handleArmClick(arm.id)}
              onMouseEnter={() => setHoveredArmId(arm.id)}
              onMouseLeave={() => setHoveredArmId(null)}
            >
              {/* hit area */}
              <path
                d={geometry.center}
                fill="none"
                stroke="#000"
                strokeOpacity={0}
                strokeWidth={26}
                strokeLinecap="round"
                pointerEvents="stroke"
              />
              <path
                d={geometry.ribbon}
                fill="rgba(200,176,232,0.32)"
                stroke="rgba(200,176,232,0.7)"
                strokeWidth={0.8}
                strokeDasharray="3 3"
              />
              <circle
                cx={geometry.tip.x}
                cy={geometry.tip.y}
                r={2.4}
                fill="#C8B0E8"
                opacity={0.8}
              />
            </motion.g>
          ))}

          {/* Center creature */}
          <CenterCreature
            cx={cx}
            cy={cy}
            radius={bodyRadius}
            pulsing={pulsingCore}
            isStreaming={isStreaming}
          />

          {/* Retired arms = fossil bits embedded in the body. Drawn AFTER the
              center creature so they sit on top of it and stay clickable
              (previously the creature disc covered them entirely). Each gets a
              generous invisible hit circle around its fossil fragment. */}
          {retired.map(({ arm, geometry }) => {
            const isHovered = hoveredArmId === arm.id;
            return (
              <g
                key={arm.id}
                style={{ cursor: "pointer", pointerEvents: "all" }}
                onClick={() => handleArmClick(arm.id)}
                onMouseEnter={() => setHoveredArmId(arm.id)}
                onMouseLeave={() => setHoveredArmId(null)}
              >
                {/* invisible hit target over the fossil */}
                <circle
                  cx={geometry.tip.x}
                  cy={geometry.tip.y}
                  r={14}
                  fill="#000"
                  fillOpacity={0}
                  pointerEvents="all"
                />
                <path
                  d={geometry.ribbon}
                  fill={isHovered ? "#7E8BA0" : "#3A4E64"}
                  opacity={isHovered ? 0.8 : 0.5}
                />
              </g>
            );
          })}
        </g>

        {/* Arm-name labels are rendered as an HTML overlay below (LabelLayer),
            not inside this SVG — that keeps them from being clipped by the
            square viewBox at the edges (where the kelp lives) and lets them
            stay persistently visible regardless of arm count. */}

        {/* Speech bubbles are rendered as an HTML overlay (see below), not
            inside this SVG, so they sit above the kelp and never get clipped
            by the viewBox. We still compute their anchor points here. */}
      </svg>

      {/* HTML speech-bubble overlay — sits above the SVG so kelp/coral can't clip it. */}
      <SpeechBubbleLayer
        active={active}
        armBubbles={armBubbles}
        cx={cx}
        cy={cy}
        svgSize={svgSize}
        swayDeg={swayDeg}
      />

      {/* HTML label overlay — persistent arm names, never clipped by the SVG
          viewBox or hidden behind the kelp. Arms showing a speech bubble skip
          their label so the two don't stack on top of each other. */}
      <LabelLayer
        active={active}
        cx={cx}
        cy={cy}
        svgSize={svgSize}
        swayDeg={swayDeg}
        selectedArmId={selectedArmId}
        hoveredArmId={hoveredArmId}
        hiddenArmIds={new Set(Object.keys(armBubbles))}
        onArmClick={handleArmClick}
        onArmHover={setHoveredArmId}
      />

      {/* AUTOPILOT badge — top of canvas, large + obvious */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
        style={{ pointerEvents: "none", zIndex: 5 }}
      >
        {autopilot ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background:
                "linear-gradient(135deg, rgba(143,255,230,0.18), rgba(185,156,255,0.18))",
              border: "1.5px solid rgba(143,255,230,0.5)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <motion.span
              animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
              className="block rounded-full"
              style={{
                width: 9,
                height: 9,
                background: "#8FFFE6",
              }}
            />
            <span
              className="font-display font-semibold text-[13px]"
              style={{
                color: "#E8F3F1",
                letterSpacing: "0.22em",
              }}
            >
              AUTOPILOT
            </span>
          </motion.div>
        ) : (
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full"
            style={{
              background: "rgba(7,21,35,0.55)",
              border: "1px solid rgba(143,255,230,0.18)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: "#8FA1AB",
              }}
            />
            <span
              className="font-display text-[12px]"
              style={{
                color: "#C7D6DA",
                letterSpacing: "0.2em",
              }}
            >
              IDLE
            </span>
          </div>
        )}

        {/* Committee banner — appears below AUTOPILOT during committee playback */}
        <AnimatePresence>
          {activeCommitteeName && (
            <motion.div
              key={activeCommitteeName}
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl"
              style={{
                background: "rgba(11,23,38,0.85)",
                border: "1px solid rgba(143,255,230,0.28)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                maxWidth: 380,
              }}
            >
              <span className="eyebrow" style={{ color: "#8FA1AB" }}>
                committee
              </span>
              <span
                className="font-display font-semibold text-[14px]"
                style={{ color: "#FFFFFF" }}
              >
                {activeCommitteeName}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Seed / context thought bubble — appears top-center during dawn/thinking */}
      <AnimatePresence>
        {seedThoughtText && (roundPhase === "dawn" || roundPhase === "thinking") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -6 }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
            style={{
              top: 84,
              maxWidth: 340,
              width: "min(86%, 340px)",
              pointerEvents: "none",
              zIndex: 4,
            }}
          >
            <div
              className="rounded-3xl px-4 py-3 text-[12.5px] leading-relaxed w-full"
              style={{
                background: "rgba(255,255,255,0.97)",
                color: "#0A1626",
                border: "1px solid rgba(7,21,35,0.4)",
                boxShadow: "0 4px 16px rgba(255,255,255,0.55)",
                fontStyle: "italic",
                textWrap: "pretty" as never,
                textAlign: "center",
              }}
            >
              <div
                className="eyebrow mb-1"
                style={{
                  color: "#0A1626",
                  opacity: 0.55,
                  fontSize: 9.5,
                  fontStyle: "normal",
                }}
              >
                thinking…
              </div>
              <div
                style={{
                  // Hard line-clamp so an unexpectedly long thought can never
                  // grow the bubble (and thus the aquarium frame). Truncates
                  // with an ellipsis instead.
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical" as never,
                  overflow: "hidden",
                }}
              >{seedThoughtText}</div>
            </div>
            {/* Thought trail descending toward the center of the creature */}
            <div className="flex flex-col items-center gap-1 mt-1">
              <motion.span
                animate={{ opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: 0 }}
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.94)",
                  border: "1px solid rgba(7,21,35,0.4)",
                }}
              />
              <motion.span
                animate={{ opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: 0.25 }}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.85)",
                  border: "1px solid rgba(7,21,35,0.3)",
                }}
              />
              <motion.span
                animate={{ opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: 0.5 }}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.75)",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speaker verdict bubble — the resolution of the round. Emerges from the
          creature during the 'sun' phase, mirroring the thought bubble that
          opened it. White speech bubble with a downward tail toward the mouth. */}
      <AnimatePresence>
        {speakerSpeechText && roundPhase === "sun" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -6 }}
            transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
            style={{
              top: 96,
              width: "min(82%, 360px)",
              pointerEvents: "none",
              zIndex: 7,
            }}
          >
            <div
              className="rounded-3xl px-4 py-3 text-[13px] leading-relaxed w-full"
              style={{
                background: "rgba(255,255,255,0.97)",
                color: "#0A1626",
                border: "1px solid rgba(7,21,35,0.4)",
                boxShadow: "0 6px 20px rgba(255,255,255,0.5)",
                textAlign: "center",
                position: "relative",
              }}
            >
              <div
                className="eyebrow mb-1"
                style={{
                  color: "#B99CFF",
                  fontSize: 9.5,
                  letterSpacing: "0.14em",
                }}
              >
                speakerbot
              </div>
              <div
                style={{
                  // Clamp so a long verdict can't grow the frame (same rule as
                  // the thought bubble).
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical" as never,
                  overflow: "hidden",
                }}
              >
                {speakerSpeechText}
              </div>
              {/* downward tail toward the creature */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: -8,
                  width: 0,
                  height: 0,
                  transform: "translateX(-50%)",
                  borderLeft: "7px solid transparent",
                  borderRight: "7px solid transparent",
                  borderTop: "9px solid rgba(255,255,255,0.97)",
                  filter: "drop-shadow(0 1px 0 rgba(7,21,35,0.4))",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="absolute left-4 top-4"
        style={{
          maxWidth: 220,
          padding: 12,
          background: "rgba(11,23,38,0.78)",
          border: "1px solid rgba(143,255,230,0.16)",
          borderRadius: 18,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          color: "#E8F3F1",
        }}
      >
        <div className="eyebrow" style={{ color: "#8FA1AB" }}>Living Solasterid</div>
        <div className="mt-1 text-[14px] font-display font-semibold" style={{ color: "#FFFFFF" }}>
          {activeCount} arms · {state.committees.length} committees
        </div>
        <div className="mt-1 text-[11.5px]" style={{ color: "#C7D6DA" }}>
          <span className="mono">{state.arms.filter((a) => a.status === "retired").length}</span> fossilized
          {state.arms.some((a) => a.status === "probation") && (
            <>
              {" · "}
              <span className="mono">
                {state.arms.filter((a) => a.status === "probation").length}
              </span>{" "}
              probation
            </>
          )}
        </div>
        <div className="mt-1.5 text-[11px] mono" style={{ color: "#8FA1AB" }}>
          round {state.round}
        </div>
      </div>

      {/* Hint — only when many arms and nothing selected */}
      {!selectedArmId && (
        <div
          className="absolute bottom-14 left-1/2 -translate-x-1/2 text-[12px] tracking-wide px-3 py-1 rounded-full"
          style={{
            color: "rgba(232,243,241,0.7)",
            background: "rgba(7,21,35,0.55)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(143,255,230,0.12)",
          }}
        >
          click any arm or its label to read its lens
        </div>
      )}

      {/* Arm detail drawer */}
      {selectedArm && (
        <ArmDetailPanel
          arm={selectedArm}
          committees={state.committees}
          transcript={state.transcript}
          onClose={() => setSelectedArmId(null)}
        />
      )}

      {/* Tempseed ribbon at the bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 px-4 py-2.5 text-[12px]"
        style={{
          background:
            "linear-gradient(180deg, rgba(3,17,31,0) 0%, rgba(3,17,31,0.85) 60%, rgba(3,17,31,0.95) 100%)",
          borderTop: "1px solid rgba(143,255,230,0.10)",
          color: "#8FA1AB",
        }}
      >
        <span className="eyebrow" style={{ color: "#8FA1AB", marginRight: 8 }}>
          seed
        </span>
        <span style={{ color: "#C7D6DA" }}>
          {state.tempseed.slice(0, 180)}
          {state.tempseed.length > 180 ? "…" : ""}
        </span>
      </div>
    </section>
  );
}
