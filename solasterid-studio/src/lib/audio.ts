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

export const DEFAULT_AUDIO_STATE: AudioState = {
  unlocked: false,
  ambienceEnabled: true,
  rosesEnabled: true,
  masterVolume: 0.8,
  ambienceVolume: 0.28,
  rosesComputedVolume: 0.06,
  rosesAssetMissing: false,
  ambienceAssetMissing: false,
  userUploadedRosesUrl: null,
};

export function computeRosesVolume(armCount: number, masterVolume: number): number {
  const min = 0.04;
  const max = 0.72;
  const growth = 1 - Math.exp(-armCount / 18);
  return (min + (max - min) * growth) * masterVolume;
}

export function computeRavePressurePercent(armCount: number): number {
  const growth = 1 - Math.exp(-armCount / 18);
  return Math.round(growth * 100);
}

export function describeRavePressure(armCount: number): string {
  const pct = computeRavePressurePercent(armCount);
  if (pct < 20) return "quiet, distant nightclub leaking through coral";
  if (pct < 45) return "audible old Flash game energy";
  if (pct < 70) return "full cognitive reef rave";
  return "capped, powerful, not physically illegal";
}
