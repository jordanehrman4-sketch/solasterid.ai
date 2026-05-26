import { motion } from "framer-motion";
import { useMemo } from "react";

/**
 * Lush reef backdrop drawn in lightweight SVG.
 * Layers, back→front:
 *   1. Deep ocean gradient + abyssal vignette
 *   2. Drifting plankton particles
 *   3. Soft caustic light rays
 *   4. Distant coral silhouettes (low contrast)
 *   5. Kelp / sea-fan fronds
 *   6. Foreground coral cluster + sand
 * All decorative; no interactive elements.
 */

type Props = {
  width: number;
  height: number;
  /** When true, animate the kelp drift / caustic shimmer. */
  alive?: boolean;
};

export function ReefBackground({ width, height, alive = true }: Props) {
  const plankton = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height * 0.85,
        r: 0.4 + Math.random() * 1.1,
        delay: Math.random() * 6,
        duration: 10 + Math.random() * 14,
        hue: Math.random() > 0.4 ? "#8FFFE6" : "#B99CFF",
      })),
    [width, height],
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <defs>
        <radialGradient id="reefVignette" cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor="#0A2236" stopOpacity="0.0" />
          <stop offset="55%" stopColor="#03111F" stopOpacity="0.0" />
          <stop offset="100%" stopColor="#03111F" stopOpacity="0.85" />
        </radialGradient>
        <linearGradient id="reefDepth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A2A40" />
          <stop offset="40%" stopColor="#071D2E" />
          <stop offset="100%" stopColor="#03111F" />
        </linearGradient>
        <linearGradient id="caustic" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8FFFE6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#8FFFE6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B2A3A" stopOpacity="0.0" />
          <stop offset="100%" stopColor="#0E1B2A" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="coralFar" cx="50%" cy="80%" r="60%">
          <stop offset="0%" stopColor="#FF6F91" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FF6F91" stopOpacity="0" />
        </radialGradient>
        <filter id="bgSoften" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
      </defs>

      {/* depth gradient */}
      <rect width={width} height={height} fill="url(#reefDepth)" />

      {/* caustic rays — soft, low contrast */}
      <g opacity="0.18" filter="url(#bgSoften)">
        {Array.from({ length: 7 }, (_, i) => {
          const baseX = (width / 8) * (i + 1);
          const w = 22 + (i % 3) * 8;
          return (
            <motion.path
              key={i}
              d={`M ${baseX} 0 L ${baseX - 14} ${height * 0.78} L ${baseX + w} ${height * 0.78} L ${baseX + 22} 0 Z`}
              fill="url(#caustic)"
              animate={
                alive
                  ? {
                      opacity: [0.08, 0.22, 0.08],
                      x: [-3, 4, -3],
                    }
                  : undefined
              }
              transition={{
                duration: 7 + i * 0.7,
                repeat: Infinity,
                delay: i * 0.5,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </g>

      {/* drifting plankton */}
      <g>
        {plankton.map((p) => (
          <motion.circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={p.hue}
            opacity={0.55}
            animate={
              alive
                ? {
                    cy: [p.y, p.y - 22, p.y],
                    cx: [p.x, p.x + 6, p.x],
                    opacity: [0.25, 0.7, 0.25],
                  }
                : undefined
            }
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </g>

      {/* warm coral haze in the lower middle */}
      <ellipse cx={width / 2} cy={height * 0.92} rx={width * 0.55} ry={height * 0.18} fill="url(#coralFar)" />

      {/* distant coral silhouettes — soft, layered */}
      <g opacity="0.42" filter="url(#bgSoften)">
        {/* left cluster */}
        <DistantBush x={width * 0.06} baseY={height * 0.88} scale={1.05} hue="#1F3148" />
        <DistantBush x={width * 0.14} baseY={height * 0.9} scale={0.85} hue="#1A2A3D" />
        {/* right cluster */}
        <DistantBush x={width * 0.86} baseY={height * 0.88} scale={1.0} hue="#1F3148" />
        <DistantBush x={width * 0.78} baseY={height * 0.9} scale={0.8} hue="#1A2A3D" />
        {/* sparse middle distance */}
        <DistantBush x={width * 0.42} baseY={height * 0.94} scale={0.7} hue="#1E3047" />
        <DistantBush x={width * 0.58} baseY={height * 0.94} scale={0.72} hue="#1E3047" />
      </g>

      {/* kelp fronds drifting */}
      <g opacity="0.65">
        <KelpFrond x={width * 0.08} baseY={height} height={height * 0.7} alive={alive} delay={0} hue="#214D3C" />
        <KelpFrond x={width * 0.92} baseY={height} height={height * 0.6} alive={alive} delay={1.4} hue="#1F4438" />
        <KelpFrond x={width * 0.18} baseY={height} height={height * 0.45} alive={alive} delay={0.6} hue="#1A3A30" />
      </g>

      {/* foreground coral cluster (painterly via stacked translucent blobs) */}
      <g opacity="0.92">
        <CoralCluster
          x={width * 0.03}
          baseY={height * 0.99}
          tints={["#5A2A3A", "#7A3A4E", "#A85370", "#FF6F91"]}
          maxHeight={height * 0.36}
          align="left"
        />
        <CoralCluster
          x={width * 0.97}
          baseY={height * 0.99}
          tints={["#5A2A3A", "#7A3A4E", "#FF9A76"]}
          maxHeight={height * 0.32}
          align="right"
        />
      </g>

      {/* sand floor */}
      <rect x={0} y={height * 0.86} width={width} height={height * 0.14} fill="url(#sand)" />

      {/* vignette on top */}
      <rect width={width} height={height} fill="url(#reefVignette)" />
    </svg>
  );
}

function DistantBush({
  x,
  baseY,
  scale,
  hue,
}: {
  x: number;
  baseY: number;
  scale: number;
  hue: string;
}) {
  // Three softly stacked translucent ellipses give a painterly coral mound.
  const s = scale;
  return (
    <g transform={`translate(${x},${baseY}) scale(${s})`}>
      <ellipse cx={0} cy={-6} rx={42} ry={18} fill={hue} opacity={0.55} />
      <ellipse cx={-14} cy={-22} rx={28} ry={20} fill={hue} opacity={0.45} />
      <ellipse cx={18} cy={-26} rx={24} ry={22} fill={hue} opacity={0.4} />
      <ellipse cx={0} cy={-40} rx={20} ry={18} fill={hue} opacity={0.32} />
    </g>
  );
}

function KelpFrond({
  x,
  baseY,
  height,
  alive,
  delay,
  hue,
}: {
  x: number;
  baseY: number;
  height: number;
  alive: boolean;
  delay: number;
  hue: string;
}) {
  // A drifting frond drawn as a few stacked translucent curves.
  return (
    <motion.g
      style={{ originX: `${x}px`, originY: `${baseY}px` }}
      animate={alive ? { rotate: [-1.5, 1.5, -1.5] } : undefined}
      transition={{ duration: 9 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {Array.from({ length: 4 }, (_, i) => {
        const offset = (i - 1.5) * 6;
        return (
          <path
            key={i}
            d={`M ${x + offset} ${baseY}
                C ${x + offset - 10} ${baseY - height * 0.4},
                  ${x + offset + 10} ${baseY - height * 0.7},
                  ${x + offset - 4} ${baseY - height}`}
            stroke={hue}
            strokeWidth={3 + i * 0.8}
            strokeLinecap="round"
            fill="none"
            opacity={0.35 + i * 0.05}
          />
        );
      })}
    </motion.g>
  );
}

function CoralCluster({
  x,
  baseY,
  tints,
  maxHeight,
  align,
}: {
  x: number;
  baseY: number;
  tints: string[];
  maxHeight: number;
  align: "left" | "right";
}) {
  // Painterly cluster: a base mound + a few branching fans.
  const dir = align === "left" ? 1 : -1;
  return (
    <g>
      {/* base mounds */}
      <ellipse cx={x + dir * 24} cy={baseY - 8} rx={70} ry={20} fill={tints[0]} opacity={0.8} />
      <ellipse cx={x + dir * 36} cy={baseY - 22} rx={48} ry={20} fill={tints[1]} opacity={0.75} />
      <ellipse cx={x + dir * 60} cy={baseY - 38} rx={36} ry={22} fill={tints[1]} opacity={0.6} />

      {/* sea-fan style fronds */}
      {tints.slice(1).map((t, i) => {
        const fx = x + dir * (40 + i * 16);
        const fh = maxHeight * (0.7 - i * 0.12);
        return (
          <g key={i} opacity={0.85 - i * 0.1}>
            <path
              d={`M ${fx} ${baseY - 10}
                  C ${fx + dir * 10} ${baseY - fh * 0.4},
                    ${fx - dir * 6} ${baseY - fh * 0.7},
                    ${fx + dir * 12} ${baseY - fh}`}
              stroke={t}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
            />
            {Array.from({ length: 6 }, (_, j) => {
              const t2 = (j + 1) / 7;
              const py = baseY - 10 - fh * t2;
              const px = fx + dir * (10 - Math.abs(t2 - 0.5) * 18);
              return (
                <ellipse
                  key={j}
                  cx={px}
                  cy={py}
                  rx={6}
                  ry={3}
                  fill={t}
                  opacity={0.7}
                  transform={`rotate(${(t2 - 0.5) * 35 * dir} ${px} ${py})`}
                />
              );
            })}
            {/* tip bloom */}
            <circle cx={fx + dir * 12} cy={baseY - fh} r={4} fill={t} opacity={0.85} />
          </g>
        );
      })}
    </g>
  );
}
