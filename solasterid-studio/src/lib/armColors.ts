/**
 * Shared display-color mapping for arms.
 *
 * The canvas walks arms grouped by committee (so each committee owns a
 * contiguous angular sector). To keep transcript card prefix dots in sync
 * with that visual order, we expose the same walk + palette here.
 */
import type { SolasteridArm, SolasteridCommittee } from "./solasteridState";

export const ARM_PALETTE = [
  "#F5A3A3", // coral pink
  "#FFE3A6", // butter yellow
  "#A8E6B2", // mint
  "#C8B0E8", // soft lavender
  "#F5C9A8", // peach
  "#B0D8E8", // sky
  "#E8B0CC", // rose
  "#F5B894", // apricot
  "#A8DCD0", // seafoam
  "#E8C588", // honey
];

export function paletteFor(index: number, stored?: string): string {
  if (stored && stored.toUpperCase().startsWith("#FF")) return stored;
  return ARM_PALETTE[index % ARM_PALETTE.length];
}

/**
 * Build { armId → displayColor }. Active arms are colored from the pastel
 * palette in committee-walk order; retired/probation arms get their stored
 * color if present, otherwise muted defaults.
 */
export function buildArmColorMap(
  arms: SolasteridArm[],
  committees: SolasteridCommittee[],
): Record<string, string> {
  const map: Record<string, string> = {};
  const active = arms.filter((a) => a.status === "active");
  const sortedComms = [...committees].sort(
    (a, b) => (a.layer ?? 0) - (b.layer ?? 0) || a.id.localeCompare(b.id),
  );
  const groups: Record<string, SolasteridArm[]> = {};
  for (const a of active) {
    const cid = a.committeeIds[0] ?? "__none";
    (groups[cid] ??= []).push(a);
  }
  const orderedKeys = [
    ...sortedComms.map((c) => c.id).filter((k) => groups[k]?.length),
    ...(groups["__none"]?.length ? ["__none"] : []),
  ];
  let i = 0;
  for (const cid of orderedKeys) {
    for (const a of groups[cid] ?? []) {
      map[a.id] = paletteFor(i, a.color);
      i++;
    }
  }
  for (const a of arms) {
    if (!map[a.id]) {
      if (a.status === "retired") map[a.id] = "#6B5A50";
      else if (a.status === "probation") map[a.id] = "#C8B0E8";
      else map[a.id] = a.color ?? "#8FFFE6";
    }
  }
  return map;
}
