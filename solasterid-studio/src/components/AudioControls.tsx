import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { SolasteridState } from "../lib/solasteridState";
import {
  DEFAULT_AUDIO_STATE,
  computeRavePressurePercent,
  computeRosesVolume,
  describeRavePressure,
  type AudioState,
} from "../lib/audio";

type Props = { state: SolasteridState };

export function AudioControls({ state }: Props) {
  const [audio, setAudio] = useState<AudioState>(DEFAULT_AUDIO_STATE);
  const [rosesMissing, setRosesMissing] = useState(false);
  const [ambienceMissing, setAmbienceMissing] = useState(false);
  const [rosesUserUrl, setRosesUserUrl] = useState<string | null>(null);
  const [meterPulse, setMeterPulse] = useState(false);

  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const rosesRef = useRef<HTMLAudioElement | null>(null);
  const prevArmCount = useRef(0);

  const activeArmCount = state.arms.filter((a) => a.status === "active").length;
  const ravePressure = computeRavePressurePercent(activeArmCount);

  // Pulse meter when arms are added
  useEffect(() => {
    if (activeArmCount > prevArmCount.current) {
      setMeterPulse(true);
      const t = setTimeout(() => setMeterPulse(false), 1200);
      prevArmCount.current = activeArmCount;
      return () => clearTimeout(t);
    }
    prevArmCount.current = activeArmCount;
  }, [activeArmCount]);

  // Update Roses volume whenever arm count or settings change
  useEffect(() => {
    const vol = computeRosesVolume(activeArmCount, audio.masterVolume);
    setAudio((prev) => ({ ...prev, rosesComputedVolume: vol }));
    if (rosesRef.current) {
      rosesRef.current.volume = audio.unlocked && audio.rosesEnabled && !rosesMissing ? vol : 0;
    }
  }, [activeArmCount, audio.masterVolume, audio.unlocked, audio.rosesEnabled, rosesMissing]);

  // Update ambience volume
  useEffect(() => {
    if (ambienceRef.current) {
      ambienceRef.current.volume = audio.unlocked && audio.ambienceEnabled && !ambienceMissing
        ? audio.ambienceVolume * audio.masterVolume
        : 0;
    }
  }, [audio.unlocked, audio.ambienceEnabled, audio.ambienceVolume, audio.masterVolume, ambienceMissing]);

  const unlockAudio = useCallback(async () => {
    setAudio((prev) => ({ ...prev, unlocked: true }));
    if (ambienceRef.current) {
      ambienceRef.current.loop = true;
      try { await ambienceRef.current.play(); } catch { setAmbienceMissing(true); }
    }
    if (rosesRef.current) {
      rosesRef.current.loop = true;
      try { await rosesRef.current.play(); } catch { setRosesMissing(true); }
    }
  }, []);

  function handleUserRosesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setRosesUserUrl(url);
    setRosesMissing(false);
    if (rosesRef.current) {
      rosesRef.current.src = url;
      rosesRef.current.loop = true;
      if (audio.unlocked) rosesRef.current.play().catch(() => {});
    }
  }

  const rosesDescription = describeRavePressure(activeArmCount);

  return (
    <section className="glass-panel p-4" style={{ borderColor: "rgba(240,171,252,0.18)" }}>
      <audio ref={ambienceRef} src="/audio/ocean-ambience.mp3" preload="none" />
      <audio ref={rosesRef} src={rosesUserUrl ?? "/audio/roses-imanbek-local.mp3"} preload="none" />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-fuchsia-200 text-glow-fuchsia tracking-wide">AUDIO REEF</h2>
        {!audio.unlocked && (
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 16px rgba(240,171,252,0.4)" }}
            whileTap={{ scale: 0.95 }}
            onClick={unlockAudio}
            className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-950"
            style={{ background: "linear-gradient(135deg, #f0abfc, #a855f7)" }}
          >
            Enable Audio
          </motion.button>
        )}
      </div>

      {/* Roses meter */}
      <div className={`mt-3 rounded-xl bg-slate-950/60 p-3 transition-all ${meterPulse ? "roses-pulse" : ""}`}>
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Cognitive nightclub gain</span>
          <span className="text-fuchsia-300 font-mono">{ravePressure}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, #818cf8, #f0abfc, #fb7185)" }}
            animate={{ width: ravePressure + "%" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500 italic">{rosesDescription}</p>
      </div>

      {/* Controls */}
      <div className="mt-3 space-y-2.5">
        <label className="flex items-center justify-between gap-3 text-xs text-slate-300 cursor-pointer">
          <span>Ocean ambience</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={audio.ambienceEnabled}
              onChange={(e) => setAudio((p) => ({ ...p, ambienceEnabled: e.target.checked }))}
              className="sr-only"
            />
            <div
              onClick={() => setAudio((p) => ({ ...p, ambienceEnabled: !p.ambienceEnabled }))}
              className={`w-8 h-4 rounded-full cursor-pointer transition-colors ${audio.ambienceEnabled ? "bg-teal-500" : "bg-slate-700"}`}
            >
              <motion.div
                className="w-3 h-3 rounded-full bg-white shadow mt-0.5"
                animate={{ x: audio.ambienceEnabled ? 17 : 2 }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>
        </label>

        <label className="flex items-center justify-between gap-3 text-xs text-slate-300 cursor-pointer">
          <span>Roses mode</span>
          <div
            onClick={() => setAudio((p) => ({ ...p, rosesEnabled: !p.rosesEnabled }))}
            className={`w-8 h-4 rounded-full cursor-pointer transition-colors ${audio.rosesEnabled ? "bg-fuchsia-500" : "bg-slate-700"}`}
          >
            <motion.div
              className="w-3 h-3 rounded-full bg-white shadow mt-0.5"
              animate={{ x: audio.rosesEnabled ? 17 : 2 }}
              transition={{ duration: 0.2 }}
            />
          </div>
        </label>

        <label className="block text-xs text-slate-400">
          <span>Master volume</span>
          <input
            className="mt-1 w-full accent-fuchsia-400"
            type="range" min="0" max="1" step="0.01"
            value={audio.masterVolume}
            onChange={(e) => setAudio((p) => ({ ...p, masterVolume: Number(e.target.value) }))}
          />
        </label>
      </div>

      {/* Roses missing notice */}
      {rosesMissing && !rosesUserUrl && (
        <div className="mt-3 rounded-xl border border-fuchsia-300/20 bg-fuchsia-950/30 p-2 text-[10px] text-fuchsia-300 leading-relaxed">
          Roses mode is enabled, but no local audio asset was found. Add your file to
          <code className="mx-1 text-fuchsia-200">/public/audio/roses-imanbek-local.mp3</code>
          or upload one:
          <label className="mt-2 block cursor-pointer rounded-lg border border-fuchsia-400/30 px-2 py-1.5 text-center hover:bg-fuchsia-900/20 transition-colors">
            Upload Roses audio
            <input type="file" accept="audio/*" className="sr-only" onChange={handleUserRosesUpload} />
          </label>
        </div>
      )}
      {ambienceMissing && (
        <div className="mt-2 text-[10px] text-slate-500 italic">
          Ocean ambience not found — add /public/audio/ocean-ambience.mp3 for the full reef experience.
        </div>
      )}
    </section>
  );
}
