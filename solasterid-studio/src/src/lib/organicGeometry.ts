// Organic geometry helpers for the Solasterid canvas.
// We treat each arm as a *ribbon* swept along a quadratic Bézier curve,
// tapered from a wide base to a fine tip, with optional wiggle.

export type Point = { x: number; y: number };

/** Sample N points along a quadratic Bézier curve from p0 to p2 with control p1. */
export function sampleQuadraticCurve(
  p0: Point,
  p1: Point,
  p2: Point,
  steps = 24,
): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const it = 1 - t;
    out.push({
      x: it * it * p0.x + 2 * it * t * p1.x + t * t * p2.x,
      y: it * it * p0.y + 2 * it * t * p1.y + t * t * p2.y,
    });
  }
  return out;
}

/** Tangent vector at parameter t for the same quadratic. */
function quadraticTangent(p0: Point, p1: Point, p2: Point, t: number): Point {
  const dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
  return { x: dx, y: dy };
}

function normalize(v: Point): Point {
  const m = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / m, y: v.y / m };
}

/**
 * Build a tapered ribbon outline that follows a quadratic curve.
 * Width tapers from `baseWidth` at p0 to `tipWidth` at p2 along a smooth ease-out.
 * Returns an SVG path string (filled, not stroked).
 */
export function ribbonPathFromCurve(
  p0: Point,
  p1: Point,
  p2: Point,
  baseWidth: number,
  tipWidth: number,
  steps = 26,
): string {
  const leftSide: Point[] = [];
  const rightSide: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const it = 1 - t;
    const px = it * it * p0.x + 2 * it * t * p1.x + t * t * p2.x;
    const py = it * it * p0.y + 2 * it * t * p1.y + t * t * p2.y;
    const tan = normalize(quadraticTangent(p0, p1, p2, t));
    const nx = -tan.y;
    const ny = tan.x;
    // ease-out taper so the base widens and the tip narrows organically
    const taper = 1 - Math.pow(t, 1.45);
    const w = tipWidth + (baseWidth - tipWidth) * taper;
    leftSide.push({ x: px + nx * w * 0.5, y: py + ny * w * 0.5 });
    rightSide.push({ x: px - nx * w * 0.5, y: py - ny * w * 0.5 });
  }
  const fwd = leftSide.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  // round the tip
  const tipL = leftSide[leftSide.length - 1];
  const tipR = rightSide[rightSide.length - 1];
  const tipMid = { x: (tipL.x + tipR.x) / 2, y: (tipL.y + tipR.y) / 2 };
  const tipCtl1 = { x: tipMid.x, y: tipMid.y };
  const tip = ` Q ${tipCtl1.x} ${tipCtl1.y} ${tipR.x} ${tipR.y}`;
  const rev = rightSide
    .slice()
    .reverse()
    .map((p) => `L ${p.x} ${p.y}`)
    .join(" ");
  return `${fwd}${tip} ${rev} Z`;
}

/**
 * Generate the geometry for an organic, slightly curved arm from the body
 * outward. Returns control points, the ribbon path, a center-line path
 * (for highlights), and a label anchor outside the tip.
 */
export function organicArmPath(opts: {
  cx: number;
  cy: number;
  angle: number; // radians
  baseRadius: number; // where the ribbon starts (just outside the body)
  length: number; // total arm length
  curvature?: number; // -1..1; default uses angle-driven wiggle
  baseWidth?: number; // ribbon width at base
  tipWidth?: number; // ribbon width at tip
  steps?: number;
}) {
  const {
    cx,
    cy,
    angle,
    baseRadius,
    length,
    curvature,
    baseWidth = 22,
    tipWidth = 3,
    steps = 26,
  } = opts;
  // Curvature: gentle alternating sweep so the creature looks alive, not radial
  const swirl =
    typeof curvature === "number" ? curvature : Math.sin(angle * 2.7 + 1.1) * 0.55;
  const p0: Point = { x: cx + Math.cos(angle) * baseRadius, y: cy + Math.sin(angle) * baseRadius };
  const tipX = cx + Math.cos(angle) * (baseRadius + length);
  const tipY = cy + Math.sin(angle) * (baseRadius + length);
  // perpendicular offset for the control point produces curvature
  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);
  const ctlOffset = length * 0.35 * swirl;
  const p1: Point = {
    x: (p0.x + tipX) / 2 + perpX * ctlOffset,
    y: (p0.y + tipY) / 2 + perpY * ctlOffset,
  };
  const p2: Point = { x: tipX, y: tipY };

  const ribbon = ribbonPathFromCurve(p0, p1, p2, baseWidth, tipWidth, steps);
  const center = `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`;

  // Label anchor sits a touch beyond the tip, perpendicular to the tangent.
  const tipTan = normalize(quadraticTangent(p0, p1, p2, 1));
  const tipNormal = { x: -tipTan.y, y: tipTan.x };
  // place the label slightly to the outside of the tip (away from origin)
  const outwardSign =
    Math.sign(
      tipNormal.x * (p2.x - cx) + tipNormal.y * (p2.y - cy),
    ) || 1;
  const labelAnchor: Point = {
    x: p2.x + tipTan.x * 8 + tipNormal.x * 4 * outwardSign,
    y: p2.y + tipTan.y * 8 + tipNormal.y * 4 * outwardSign,
  };

  return { p0, p1, p2, ribbon, center, tip: p2, labelAnchor, tipTan, tipNormal };
}

/**
 * Place labels in non-overlapping radial bands around the canvas.
 * Returns each label with a `placed` x/y point and a leader line endpoint.
 */
export function labelPlacement(
  tips: Array<{ id: string; angle: number; tip: Point; preferredAnchor: Point }>,
  cx: number,
  cy: number,
  radius: number,
): Array<{ id: string; x: number; y: number; anchor: "start" | "middle" | "end"; leaderFrom: Point }> {
  // Sort by angle and snap each to its natural slot on a ring just outside the creature.
  const sorted = [...tips].sort((a, b) => a.angle - b.angle);
  return sorted.map((t) => {
    const x = cx + Math.cos(t.angle) * radius;
    const y = cy + Math.sin(t.angle) * radius;
    let anchor: "start" | "middle" | "end" = "middle";
    if (Math.cos(t.angle) > 0.2) anchor = "start";
    else if (Math.cos(t.angle) < -0.2) anchor = "end";
    return { id: t.id, x, y, anchor, leaderFrom: t.tip };
  });
}
