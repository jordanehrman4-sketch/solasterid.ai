import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { organicArmPath } from "../lib/organicGeometry";

type Props = { onApiKeyReady: (key: string) => void };

const DEMO_PALETTE = [
  "#F5A3A3", "#FFE3A6", "#A8E6B2", "#C8B0E8", "#F5C9A8",
  "#B0D8E8", "#E8B0CC", "#F5B894",
];

/**
 * A miniature starfish that loops through a growth animation:
 *   r=0 → 3 → 5 → 7 → reset.
 * Slowly rotates throughout.
 */
function GrowingStarfish() {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const bodyRadius = 22;
  const armLength = 78;
  const TOTAL = 8;
  const PHASE_DURATION = 1500; // ms per growth phase
  const phases = [3, 5, 7, TOTAL]; // # arms visible at each step

  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const iv = window.setInterval(() => {
      setPhaseIndex((p) => (p + 1) % phases.length);
    }, PHASE_DURATION);
    return () => window.clearInterval(iv);
  }, []);

  // Pre-compute arm geometry for all 8 slots (top-centered, evenly spaced)
  const armSlots = Array.from({ length: TOTAL }, (_, i) => {
    const angle = (i / TOTAL) * Math.PI * 2 - Math.PI / 2;
    const len = armLength * (0.88 + ((i % 3) - 1) * 0.05);
    const geo = organicArmPath({
      cx,
      cy,
      angle,
      baseRadius: bodyRadius - 4,
      length: len,
      curvature: Math.sin(angle * 2.4) * 0.45,
      baseWidth: 11,
      tipWidth: 1.6,
    });
    return { i, angle, len, geo, color: DEMO_PALETTE[i % DEMO_PALETTE.length] };
  });

  // Papulae dots
  const papulae = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    return {
      x: cx + Math.cos(a) * bodyRadius * 0.86,
      y: cy + Math.sin(a) * bodyRadius * 0.86,
      r: 1 + (i % 2 === 0 ? 0.3 : 0),
    };
  });

  const targetArmCount = phases[phaseIndex];

  return (
    <motion.svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="mx-auto mb-2"
      animate={{ rotate: 360 }}
      transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      style={{ transformOrigin: `${cx}px ${cy}px` }}
    >
      <defs>
        <radialGradient id="gateBodyGrad" cx="40%" cy="38%" r="72%">
          <stop offset="0%" stopColor="#D38667" />
          <stop offset="55%" stopColor="#A35234" />
          <stop offset="100%" stopColor="#5E2613" />
        </radialGradient>
        <radialGradient id="gateAura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(143,255,230,0.45)" />
          <stop offset="55%" stopColor="rgba(100,245,230,0.18)" />
          <stop offset="100%" stopColor="rgba(143,255,230,0)" />
        </radialGradient>
        <filter id="gateSoftGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Aura */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={bodyRadius * 4}
        fill="url(#gateAura)"
        animate={{ opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Arms */}
      <AnimatePresence>
        {armSlots.map((slot) => {
          const visible = slot.i < targetArmCount;
          return (
            <motion.g
              key={slot.i}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={
                visible
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.3 }
              }
              transition={{
                duration: 0.55,
                delay: visible ? slot.i * 0.08 : 0,
                ease: [0.2, 0.7, 0.2, 1],
              }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            >
              <path
                d={slot.geo.ribbon}
                fill={slot.color}
                stroke="rgba(0,0,0,0.25)"
                strokeWidth={0.4}
              />
              <path
                d={slot.geo.center}
                fill="none"
                stroke="rgba(255,255,255,0.5)"
                strokeWidth={0.7}
                opacity={0.5}
              />
              <circle
                cx={slot.geo.tip.x}
                cy={slot.geo.tip.y}
                r={1.6}
                fill="#FFFFFF"
                filter="url(#gateSoftGlow)"
              />
            </motion.g>
          );
        })}
      </AnimatePresence>

      {/* Body */}
      <circle
        cx={cx}
        cy={cy}
        r={bodyRadius}
        fill="url(#gateBodyGrad)"
        stroke="#5A2A1A"
        strokeWidth={1}
      />
      <ellipse
        cx={cx - bodyRadius * 0.35}
        cy={cy - bodyRadius * 0.4}
        rx={bodyRadius * 0.45}
        ry={bodyRadius * 0.28}
        fill="rgba(255,220,180,0.2)"
      />
      {papulae.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#FFC788" opacity={0.85} />
      ))}
      {/* Mouth */}
      <circle cx={cx} cy={cy} r={bodyRadius * 0.22} fill="#0A0608" />
      <circle
        cx={cx - bodyRadius * 0.06}
        cy={cy - bodyRadius * 0.06}
        r={bodyRadius * 0.04}
        fill="#FFFFFF"
        opacity={0.4}
      />
    </motion.svg>
  );
}

export function ApiKeyGate({ onApiKeyReady }: Props) {
  const [draftKey, setDraftKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const trimmed = draftKey.trim();
  const provider = trimmed.startsWith("sk-ant-") ? "anthropic" : trimmed ? "openai" : null;

  function submit() {
    if (!trimmed) return;
    onApiKeyReady(trimmed);
    setDraftKey("");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      {/* Floating bubbles in background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: 12 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: (6 + i * 8) + "%",
              bottom: "-20px",
              width: 4 + (i % 5) * 3,
              height: 4 + (i % 5) * 3,
              background:
                "radial-gradient(circle at 30% 30%, rgba(168,255,235,0.45), rgba(168,255,235,0.05) 65%, transparent)",
            }}
            animate={{ y: [0, -window.innerHeight * 0.95], opacity: [0.55, 0] }}
            transition={{
              duration: 10 + i * 1.4,
              delay: i * 0.8,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="glass-panel glass-panel--strong relative w-full max-w-md p-8"
        style={{ borderColor: "rgba(10,33,56,0.20)" }}
      >
        <GrowingStarfish />

        <h1
          className="text-center font-display font-semibold tracking-tight"
          style={{
            fontSize: 28,
            color: "var(--text-strong)",
            letterSpacing: "-0.01em",
          }}
        >
          Solasterid Studio
        </h1>

        <p
          className="mt-2 text-center text-[13.5px] leading-relaxed"
          style={{ color: "var(--text-soft)" }}
        >
          Grow a starfish that thinks for you.
          <br />
          Survive 50 rounds and take it home.
        </p>

        <label
          className="mt-7 block text-[12px] font-display"
          style={{ color: "var(--text)", letterSpacing: "0.04em" }}
        >
          <div className="flex items-center justify-between">
            <span>API key</span>
            {provider && (
              <span
                className="text-[10px] font-semibold"
                style={{ color: provider === "anthropic" ? "var(--lavender)" : "var(--foam)", letterSpacing: "0.06em" }}
              >
                {provider === "anthropic" ? "Anthropic detected" : "OpenAI detected"}
              </span>
            )}
          </div>
          <div className="relative mt-2">
            <input
              type={showKey ? "text" : "password"}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="sk-… or sk-ant-…"
              className="w-full rounded-2xl px-4 py-3 outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.78)",
                border: "1px solid rgba(10,33,56,0.16)",
                color: "var(--text-strong)",
                fontFamily: "JetBrains Mono, ui-monospace, monospace",
                fontSize: 13,
              }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] eyebrow hover:text-[var(--text)]"
              style={{ color: "var(--text-mute)" }}
              tabIndex={-1}
            >
              {showKey ? "hide" : "peek"}
            </button>
          </div>
        </label>

        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ y: 1 }}
          onClick={submit}
          disabled={!draftKey.trim()}
          className="btn btn-primary mt-5 w-full"
          style={{ padding: "12px 16px", fontSize: 14 }}
        >
          Enter the Reef
        </motion.button>

        <p
          className="mt-4 text-center text-[11px] leading-relaxed"
          style={{ color: "var(--text-mute)" }}
        >
          Your key stays in this tab's RAM. Never logged, never exported,
          never sent anywhere except the OpenAI or Anthropic API.
        </p>
      </motion.div>
    </div>
  );
}
