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
  rosesComputedVolume: 5 / 128,
  rosesAssetMissing: false,
  ambienceAssetMissing: false,
  userUploadedRosesUrl: null,
};

/**
 * Roses volume is *strictly linear* in active arm count, capped at 128 arms.
 *   armCount =   5 →  5/128 of full volume   (≈ 4%)
 *   armCount =  64 → 64/128                  (= 50%)
 *   armCount = 128 → 128/128                 (= 100%)
 * Below 5 arms the gain is held at the floor so a fresh creature isn't silent.
 * Master volume is applied on top of that.
 */
export const ROSES_CAP = 128;
export const ROSES_FLOOR_ARMS = 5;

export function computeRosesVolume(armCount: number, masterVolume: number): number {
  const arms = Math.max(ROSES_FLOOR_ARMS, Math.min(ROSES_CAP, armCount));
  const fraction = arms / ROSES_CAP;
  return fraction * masterVolume;
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
