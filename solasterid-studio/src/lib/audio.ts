export type AudioState = {
  unlocked: boolean;
  ambienceEnabled: boolean;
  rosesEnabled: boolean;
  masterVolume: number;
  ambienceVolume: number;
  rosesComputedVolume: number;
  rosesAssetMissing: boolean;
  ambienceAssetMissing: boolean;
  userUploadedRosesUrl: string | null;
};

/**
 * Both audio tracks are enabled by default. The `unlocked` flag stays false
 * until the user hits "enable audio" — browser autoplay policy requires a
 * gesture, there is no way around that.
 */
export const DEFAULT_AUDIO_STATE: AudioState = {
  unlocked: false,
  ambienceEnabled: true,
  rosesEnabled: true,
  masterVolume: 0.8,
  ambienceVolume: 0.42, // a touch louder so users hear the reef before the rave
  // Recomputed live on mount; seeded here at the new rescaled 5-arm level
  // (5/128 · ROSES_MAX_GAIN ≈ 0.0015) so it never momentarily blares.
  rosesComputedVolume: (5 / 128) * (5 / 128),
  rosesAssetMissing: false,
  ambienceAssetMissing: false,
  userUploadedRosesUrl: null,
};

/**
 * Roses gain is linear in active arm count, capped at 128 arms — but the whole
 * range is now scaled DOWN hard. The previous mapping let Roses reach full
 * volume (louder than the ocean ambience, which was never the intent). The
 * user's calibration: the old ~5-arm level was already as loud as they ever
 * want Roses to get. So we treat that old level as the new *ceiling*.
 *
 *   old 5-arm gain  = 5/128 ≈ 0.039   ← this is now ROSES_MAX_GAIN
 *
 * The arm fraction (0→1 across 5..128 arms) is multiplied by ROSES_MAX_GAIN
 * instead of 1.0, then by master. Net effect:
 *   armCount =   5 → ~0.0015 · master  (a whisper under the reef)
 *   armCount =  64 → ~0.020  · master
 *   armCount = 128 → ~0.039  · master  (the old 5-arm level — the new max)
 * That keeps Roses comfortably beneath ambienceVolume (0.42) at all times.
 */
export const ROSES_CAP = 128;
export const ROSES_FLOOR_ARMS = 5;
/** The loudest Roses ever gets, as a fraction of master. = the old 5-arm gain. */
export const ROSES_MAX_GAIN = 5 / 128;

export function computeRosesVolume(armCount: number, masterVolume: number): number {
  const arms = Math.max(ROSES_FLOOR_ARMS, Math.min(ROSES_CAP, armCount));
  const fraction = arms / ROSES_CAP; // 0..1 across the arm range
  return fraction * ROSES_MAX_GAIN * masterVolume;
}

export function computeRavePressurePercent(armCount: number): number {
  const arms = Math.max(0, Math.min(ROSES_CAP, armCount));
  return Math.round((arms / ROSES_CAP) * 100);
}

export function describeRavePressure(armCount: number): string {
  const pct = computeRavePressurePercent(armCount);
  if (pct < 8) return "barely audible, a single distant kick drum through the coral";
  if (pct < 25) return "you can almost make out the chorus";
  if (pct < 50) return "audible old-Flash-game energy, the reef is bobbing";
  if (pct < 80) return "full cognitive reef rave";
  return "capped at 128 arms — powerful, not physically illegal";
}
