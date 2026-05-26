import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useEffect, useRef, useState } from "react";
import type { SolasteridState, SolasteridArm, SolasteridCommittee } from "../lib/solasteridState";
import { ArmDetailPanel } from "./ArmDetailPanel";

type Props = {
  state: SolasteridState;
};

type Bubble = { id: number; x: number; size: number; delay: number; duration: number };

function useBubbles(count = 18) {
  return useMemo<Bubble[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      size: 3 + Math.random() * 7,
      delay: Math.random() * 8,
      duration: 7 + Math.random() * 9,
    }));
  }, [count]);
}

function armLayout(arms: SolasteridArm[], committees: SolasteridCommittee[], cx: number, cy: number) {
  const active = arms.filter((a) => a.status === "active");
  const retired = arms.filter((a) => a.status === "retired");
  const probation = arms.filter((a) => a.status === "probation");

  const sortedComms = [...committees].sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0) || a.id.localeCompare(b.id));
  const commOrder = sortedComms.map((c) => c.id);

  const commSectors: Record<string, SolasteridArm[]> = {};
  for (const arm of active) {
    const cid = arm.committeeIds[0] ?? "__none";
    if (!commSectors[cid]) commSectors[cid] = [];
    commSectors[cid].push(arm);
  }
  const unassigned = active.filter((a) => !a.committeeIds.length);
  if (unassigned.length) commSectors["__none"] = unassigned;

  const orderedSectorKeys = [...commOrder.filter((k) => commSectors[k]), "__none"].filter(
    (k) => commSectors[k]?.length
  );

  const totalActive = active.length || 1;
  let currentAngle = -Math.PI / 2;

  type ArmPos = { arm: SolasteridArm; x: number; y: number; angle: number; r: number };
  const positions: ArmPos[] = [];
  const sectorBounds: Array<{ cid: string; startAngle: number; endAngle: number; color: string }> = [];

  for (const sectorKey of orderedSectorKeys) {
    const sectorArms = commSectors[sectorKey] ?? [];
    const sectorFraction = sectorArms.length / totalActive;
    const sectorSpan = sectorFraction * (Math.PI * 2);
    const sectorStart = currentAngle;
    const sectorEnd = currentAngle + sectorSpan;

    const comm = committees.find((c) => c.id === sectorKey);
    sectorBounds.push({
      cid: sectorKey,
      startAngle: sectorStart,
      endAngle: sectorEnd,
      color: comm?.color ?? "#67e8f9",
    });

    for (let i = 0; i < sectorArms.length; i++) {
      const t = sectorArms.length === 1 ? 0.5 : i / (sectorArms.length - 1);
      const angle = sectorStart + t * sectorSpan;
      const layer = comm?.layer ?? 1;
      const baseR = 125 + layer * 16;
      const r = baseR + (i % 2 === 0 ? 0 : 10);
      positions.push({
        arm: sectorArms[i],
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        angle,
        r,
      });
    }
    currentAngle = sectorEnd;
  }

  const retiredPositions = retired.map((arm, i) => {
    const angle = (i / (retired.length || 1)) * Math.PI * 2 - Math.PI / 2;
    const r = 75;
    return { arm, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, angle, r };
  });

  const probationPositions = probation.map((arm, i) => {
    const angle = (i / (probation.length || 1)) * Math.PI * 2 - Math.PI / 3;
    const r = 178;
    return { arm, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, angle, r };
  });

  return { positions, retiredPositions, probationPositions, sectorBounds };
}

function armPath(cx: number, cy: number, x2: number, y2: number, angle: number) {
  const wiggle = 20 * Math.sin(angle * 3.7);
  const perpX = -Math.sin(angle) * wiggle;
  const perpY = Math.cos(angle) * wiggle;
  const cpx = (cx + x2) / 2 + perpX;
  const cpy = (cy + y2) / 2 + perpY;
  return `M ${cx} ${cy} Q ${cpx} ${cpy} ${x2} ${y2}`;
}

function CoralSilhouettes() {
  return (
    <g opacity="0.35">
      <path d="M 20 440 Q 30 390 22 360 Q 40 330 28 300 Q 50 310 35 280 M 28 380 Q 10 350 18 320 M 22 340 Q 42 320 38 295" stroke="#e0664a" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M 55 440 Q 65 400 58 380 Q 80 355 62 330" stroke="#c0a060" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M 420 440 Q 415 390 425 360 Q 405 325 418 295 Q 395 310 408 275 M 418 380 Q 435 345 428 315 M 424 335 Q 402 318 406 288" stroke="#e0664a" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M 385 440 Q 378 405 388 382 Q 368 355 380 328" stroke="#c0a060" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M 200 440 Q 205 430 200 420 Q 215 410 205 398" stroke="#e075a0" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M 240 440 Q 244 432 240 424 Q 252 415 244 404" stroke="#e075a0" strokeWidth="4" strokeLinecap="round" fill="none" />
      <ellipse cx="220" cy="445" rx="210" ry="8" fill="#b8a870" opacity="0.25" />
    </g>
  );
}

function CausticRays() {
  const rays = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    id: i,
    x: 30 + i * 65,
    width: 18 + i * 4,
    delay: i * 1.3,
    duration: 6 + i * 0.8,
  })), []);

  return (
    <g opacity="0.12">
      {rays.map((ray) => (
        <motion.path
          key={ray.id}
          d={`M ${ray.x} 0 L ${ray.x - 12} 440 L ${ray.x + ray.width} 440 L ${ray.x + 20} 0 Z`}
          fill="url(#causticGrad)"
          animate={{ skewX: [-2, 2, -2], opacity: [0.07, 0.18, 0.07] }}
          transition={{ duration: ray.duration, repeat: Infinity, delay: ray.delay, ease: "easeInOut" }}
        />
      ))}
    </g>
  );
}

export function SolasteridCanvas({ state }: Props) {
  const svgSize = 440;
  const cx = svgSize / 2;
  const cy = svgSize / 2;

  const bubbles = useBubbles(16);
  const [pulsingCore, setPulsingCore] = useState(false);
  const [selectedArmId, setSelectedArmId] = useState<string | null>(null);
  const [hoveredArmId, setHoveredArmId] = useState<string | null>(null);
  const prevRound = useRef(state.round);

  useEffect(() => {
    if (state.round !== prevRound.current) {
      prevRound.current = state.round;
      setPulsingCore(true);
      const t = setTimeout(() => setPulsingCore(false), 900);
      return () => clearTimeout(t);
    }
  }, [state.round]);

  const { positions, retiredPositions, probationPositions, sectorBounds } = useMemo(
    () => armLayout(state.arms, state.committees, cx, cy),
    [state.arms, state.committees, cx, cy]
  );

  // Labels visible when: ≤12 active arms, or arm is hovered/selected
  const activeCount = state.arms.filter((a) => a.status === "active").length;
  const alwaysShowLabels = activeCount <= 12;

  const selectedArm = state.arms.find((a) => a.id === selectedArmId) ?? null;

  function handleArmClick(armId: string) {
    setSelectedArmId((prev) => (prev === armId ? null : armId));
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-cyan-300/20 shadow-2xl"
      style={{ background: "linear-gradient(180deg, #050d1a 0%, #061428 40%, #081830 70%, #0a1410 100%)", minHeight: 500 }}
    >
      {/* Floating bubbles */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {bubbles.map((b) => (
          <motion.div
            key={b.id}
            className="absolute rounded-full border border-cyan-300/30"
            style={{
              left: b.x + "%",
              bottom: "-20px",
              width: b.size,
              height: b.size,
              background: "radial-gradient(circle at 30% 30%, rgba(103,232,249,0.3), transparent)",
            }}
            animate={{ y: [0, -600], opacity: [0.6, 0] }}
            transition={{ duration: b.duration, delay: b.delay, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>

      {/* Main SVG */}
      <svg
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className="mx-auto block"
        style={{ width: "100%", maxWidth: svgSize, height: "auto" }}
      >
        <defs>
          <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0d9488" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#065f46" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#050d1a" stopOpacity="0.4" />
          </radialGradient>
          <radialGradient id="bodyGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#164e63" />
            <stop offset="100%" stopColor="#0a1628" />
          </radialGradient>
          <linearGradient id="causticGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="1" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="strongGlow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="selectedGlow">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <CausticRays />

        {/* Committee sector arcs */}
        {sectorBounds.map((sector) => {
          if (sector.cid === "__none") return null;
          const outerR = 165;
          const arcThick = 10;
          const midAngle = (sector.startAngle + sector.endAngle) / 2;
          const span = sector.endAngle - sector.startAngle;
          if (span < 0.05) return null;
          const x1 = cx + Math.cos(sector.startAngle) * outerR;
          const y1 = cy + Math.sin(sector.startAngle) * outerR;
          const x2 = cx + Math.cos(sector.endAngle) * outerR;
          const y2 = cy + Math.sin(sector.endAngle) * outerR;
          const largeArc = span > Math.PI ? 1 : 0;
          return (
            <g key={sector.cid}>
              <path
                d={`M ${cx + Math.cos(sector.startAngle) * (outerR - arcThick)} ${cy + Math.sin(sector.startAngle) * (outerR - arcThick)} A ${outerR - arcThick} ${outerR - arcThick} 0 ${largeArc} 1 ${cx + Math.cos(sector.endAngle) * (outerR - arcThick)} ${cy + Math.sin(sector.endAngle) * (outerR - arcThick)} L ${x2} ${y2} A ${outerR} ${outerR} 0 ${largeArc} 0 ${x1} ${y1} Z`}
                fill={sector.color}
                opacity="0.07"
              />
              <text
                x={cx + Math.cos(midAngle) * (outerR + 14)}
                y={cy + Math.sin(midAngle) * (outerR + 14)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={sector.color}
                fontSize="5.5"
                opacity="0.65"
              >
                {(state.committees.find((c) => c.id === sector.cid)?.name ?? "").slice(0, 16)}
              </text>
            </g>
          );
        })}

        {/* Retired arms — fossilized inner ring */}
        {retiredPositions.map(({ arm, x, y, angle }) => (
          <g
            key={arm.id}
            opacity={hoveredArmId === arm.id ? 0.55 : 0.2}
            style={{ cursor: "pointer" }}
            onClick={() => handleArmClick(arm.id)}
            onMouseEnter={() => setHoveredArmId(arm.id)}
            onMouseLeave={() => setHoveredArmId(null)}
          >
            <path d={armPath(cx, cy, x, y, angle)} stroke="#475569" strokeWidth="5" strokeLinecap="round" fill="none" />
            <circle cx={x} cy={y} r="5" fill="#334155" />
            {hoveredArmId === arm.id && (
              <text x={x + Math.cos(angle) * 10} y={y + Math.sin(angle) * 10} textAnchor="middle" fill="#64748b" fontSize="7">
                {arm.name.slice(0, 18)}
              </text>
            )}
          </g>
        ))}

        {/* Active arms */}
        <AnimatePresence>
          {positions.map(({ arm, x, y, angle }, i) => {
            const isSelected = selectedArmId === arm.id;
            const isHovered = hoveredArmId === arm.id;
            const showLabel = alwaysShowLabels || isHovered || isSelected;
            const color = arm.color ?? "#67e8f9";

            return (
              <motion.g
                key={arm.id}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.3 }}
                transition={{ duration: 0.65, delay: i * 0.03 }}
                style={{ cursor: "pointer" }}
                onClick={() => handleArmClick(arm.id)}
                onMouseEnter={() => setHoveredArmId(arm.id)}
                onMouseLeave={() => setHoveredArmId(null)}
              >
                {/* Arm body */}
                <motion.path
                  d={armPath(cx, cy, x, y, angle)}
                  stroke={color}
                  strokeWidth={isSelected ? 18 : isHovered ? 16 : 13}
                  strokeLinecap="round"
                  fill="none"
                  filter={isSelected ? "url(#selectedGlow)" : "url(#glow)"}
                  opacity={isSelected ? 1 : isHovered ? 0.95 : 0.78}
                  animate={{ strokeOpacity: [0.72, 1, 0.72] }}
                  transition={{ duration: 2.8 + i * 0.12, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* Hit zone (invisible, larger than the stroke) */}
                <path
                  d={armPath(cx, cy, x, y, angle)}
                  stroke="transparent"
                  strokeWidth="28"
                  fill="none"
                />

                {/* Tip glow */}
                <motion.circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 13 : 9}
                  fill={color}
                  filter={isSelected ? "url(#selectedGlow)" : "url(#strongGlow)"}
                  animate={{ r: isSelected ? [12, 15, 12] : [8, 11, 8], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 2.4 + i * 0.1, repeat: Infinity, ease: "easeInOut" }}
                />
                <circle cx={x} cy={y} r={isSelected ? 5 : 4} fill="#fff" opacity={isSelected ? 1 : 0.8} />

                {/* Label — always shown when ≤12 arms or when hovered/selected */}
                <AnimatePresence>
                  {showLabel && (
                    <motion.text
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      x={x + Math.cos(angle) * 17}
                      y={y + Math.sin(angle) * 17}
                      textAnchor={Math.cos(angle) > 0.15 ? "start" : Math.cos(angle) < -0.15 ? "end" : "middle"}
                      dominantBaseline="middle"
                      fill={isSelected ? color : "#e2e8f0"}
                      fontSize={isSelected ? 8.5 : 7.5}
                      fontWeight={isSelected ? "bold" : "normal"}
                      opacity={isSelected ? 1 : 0.85}
                    >
                      {arm.name.slice(0, 22)}
                    </motion.text>
                  )}
                </AnimatePresence>
              </motion.g>
            );
          })}
        </AnimatePresence>

        {/* Probation arms */}
        {probationPositions.map(({ arm, x, y, angle }, i) => (
          <motion.g
            key={arm.id}
            animate={{ opacity: [0.4, 0.85, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
            style={{ cursor: "pointer" }}
            onClick={() => handleArmClick(arm.id)}
          >
            <path d={armPath(cx, cy, x, y, angle)} stroke="#94a3b8" strokeWidth="10" strokeLinecap="round" fill="none" strokeDasharray="6 4" />
            <circle cx={x} cy={y} r="6" fill="#94a3b8" opacity="0.6" />
            <text x={x} y={y + 16} textAnchor="middle" fill="#94a3b8" fontSize="7" opacity="0.7">
              {arm.name.slice(0, 16)} (?)
            </text>
          </motion.g>
        ))}

        {/* Central starfish body */}
        <motion.circle
          cx={cx} cy={cy} r="38"
          fill="url(#bodyGrad)"
          stroke="#0d9488"
          strokeWidth="3"
          filter="url(#glow)"
          animate={{ r: [36, 42, 36], strokeOpacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.circle
          cx={cx} cy={cy}
          r={pulsingCore ? 54 : 38}
          fill="url(#coreGrad)"
          opacity={pulsingCore ? 0.55 : 0.28}
          transition={{ duration: 0.5 }}
        />

        <text x={cx} y={cy - 7} textAnchor="middle" fill="#67e8f9" fontSize="9" fontWeight="bold" opacity="0.95">
          Speakerbot
        </text>
        <text x={cx} y={cy + 7} textAnchor="middle" fill="#94a3b8" fontSize="7.5">r{state.round}</text>
        <text x={cx} y={cy + 19} textAnchor="middle" fill="#5eead4" fontSize="6.5" opacity="0.8">
          {activeCount} arms
        </text>

        <CoralSilhouettes />
      </svg>

      {/* Arm detail drawer */}
      {selectedArm && (
        <ArmDetailPanel
          arm={selectedArm}
          committees={state.committees}
          transcript={state.transcript}
          onClose={() => setSelectedArmId(null)}
        />
      )}

      {/* Status overlay */}
      <div className="absolute left-4 top-4 glass-panel p-3 text-xs" style={{ maxWidth: 190 }}>
        <div className="text-glow-teal font-bold text-cyan-200 text-sm">Living Solasterid</div>
        <div className="mt-1 text-slate-400">
          <span className="text-cyan-300">{activeCount}</span> active
          {" · "}
          <span className="text-slate-500">{state.arms.filter((a) => a.status === "retired").length}</span> fossilized
        </div>
        <div className="mt-1 text-slate-600 text-[10px]">{state.committees.length} committees</div>
        {activeCount > 12 && !selectedArmId && (
          <div className="mt-1.5 text-[9px] text-slate-600 italic">tap an arm to inspect</div>
        )}
        {state.status === "running" && (
          <motion.div
            className="mt-2 text-[10px] text-teal-400"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >◉ growing…</motion.div>
        )}
      </div>

      {/* Tempseed preview */}
      <div className="absolute bottom-0 left-0 right-0 rounded-none rounded-b-3xl border-t border-cyan-300/10 bg-slate-950/70 px-4 py-2 text-xs text-slate-400 backdrop-blur">
        <span className="mr-1 text-cyan-700">seed:</span>
        {state.tempseed.slice(0, 160)}{state.tempseed.length > 160 ? "…" : ""}
      </div>
    </section>
  );
}
