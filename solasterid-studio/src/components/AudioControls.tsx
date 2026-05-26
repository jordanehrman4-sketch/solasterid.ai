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

function Toggle({
  checked,
  onChange,
  tint = "var(--foam)",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  tint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="relative rounded-full transition-all"
      style={{
        width: 34,
        height: 18,
        background: checked ? `${tint}55` : "rgba(255,255,255,0.06)",
        border: `1px solid ${checked ? `${tint}88` : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <motion.span
        className="block rounded-full"
        animate={{ x: checked ? 16 : 2 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
        style={{
          width: 12,
          height: 12,
          margin: 2,
          background: checked ? tint : "rgba(199,214,218,0.7)",
          boxShadow: checked ? `0 0 8px ${tint}` : "none",
        }}
      />
    </button>
  );
}

export function AudioControls({ state }: Props) {
  const [audio, setAudio] = useState<AudioState>(DEFAULT_AUDIO_STATE);
  const [rosesMissing, setRosesMissing] = useState(false);
  const [ambienceMissing, setAmbienceMissing] = useState(false);
  const [rosesUserUrl, setRosesUserUrl] = useState<string | null>(null);
  const [meterPulse, setMeterPulse] = useState(false);

  // Vite emits assets relative to `base` (see vite.config.ts). Files under
  // /public/audio/ are served at `${base}audio/...`, so we have to prepend
  // BASE_URL to absolute root paths — otherwise a subpath deploy (e.g.
  // username.github.io/repo/) tries to fetch /audio/... from the org root
  // and gets a 404.
  const base = import.meta.env.BASE_URL || "./";
  const ambienceUrl = `${base}audio/ocean-ambience.mp3`.replace(/\/+/g, "/");
  const rosesUrl = `${base}audio/roses-imanbek-local.mp3`.replace(/\/+/g, "/");

  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const rosesRef = useRef<HTMLAudioElement | null>(null);
  const prevArmCount = useRef(0);

  const activeArmCount = state.arms.filter((a) => a.status === "active").length;
  const ravePressure = computeRavePressurePercent(activeArmCount);

  useEffect(() => {
    if (activeArmCount > prevArmCount.current) {
      setMeterPulse(true);
      const t = setTimeout(() => setMeterPulse(false), 1400);
      prevArmCount.current = activeArmCount;
      return () => clearTimeout(t);
    }
    prevArmCount.current = activeArmCount;
  }, [activeArmCount]);

  useEffect(() => {
    const vol = computeRosesVolume(activeArmCount, audio.masterVolume);
    setAudio((prev) => ({ ...prev, rosesComputedVolume: vol }));
    if (rosesRef.current) {
      rosesRef.current.volume =
        audio.unlocked && audio.rosesEnabled && !rosesMissing ? vol : 0;
    }
  }, [activeArmCount, audio.masterVolume, audio.unlocked, audio.rosesEnabled, rosesMissing]);

  useEffect(() => {
    if (ambienceRef.current) {
      ambienceRef.current.volume =
        audio.unlocked && audio.ambienceEnabled && !ambienceMissing
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
    <section className="glass-panel" style={{ padding: 16 }}>
      <audio ref={ambienceRef} src={ambienceUrl} preload="none" />
      <audio
        ref={rosesRef}
        src={rosesUserUrl ?? rosesUrl}
        preload="none"
      />

      <div className="flex items-center justify-between">
        <div className="eyebrow">Audio Reef</div>
        {!audio.unlocked && (
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ y: 1 }}
            onClick={unlockAudio}
            className="btn"
            style={{
              padding: "5px 10px",
              fontSize: 11,
              background: "linear-gradient(135deg, rgba(185,156,255,0.85), rgba(100,245,230,0.85))",
              color: "#03111F",
              border: "1px solid rgba(143,255,230,0.4)",
              fontWeight: 600,
            }}
          >
            enable audio
          </motion.button>
        )}
      </div>

      {/* Rave pressure meter */}
      <div
        className={`mt-3 rounded-2xl p-3 transition-all ${meterPulse ? "roses-pulse" : ""}`}
        style={{
          background: "rgba(7,21,35,0.55)",
          border: "1px solid rgba(185,156,255,0.18)",
        }}
      >
        <div className="flex justify-between items-baseline">
          <span className="eyebrow">Cognitive Nightclub Gain</span>
          <span
            className="mono text-[11.5px]"
            style={{ color: "var(--lavender)" }}
          >
            {ravePressure}%
          </span>
        </div>

        {/* Layered meter — pressure gradient + soft tick scale */}
        <div className="mt-2 relative">
          <div className="progress-track" style={{ height: 8 }}>
            <motion.div
              className="progress-fill progress-fill--coral"
              animate={{ width: ravePressure + "%" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>
          {/* Tick marks */}
          <div
            className="absolute inset-0 flex justify-between pointer-events-none"
            style={{ paddingInline: 0 }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                style={{
                  width: 1,
                  height: 8,
                  background: "rgba(255,255,255,0.18)",
                  opacity: i === 0 || i === 4 ? 0 : 1,
                }}
              />
            ))}
          </div>
        </div>

        <p
          className="mt-2 text-[10.5px] leading-relaxed italic"
          style={{ color: "var(--text-soft)" }}
        >
          {rosesDescription}
        </p>
      </div>

      {/* Toggles */}
      <div className="mt-3 space-y-2.5">
        <div className="flex items-center justify-between text-[12px]">
          <span style={{ color: "var(--text)" }}>Ocean ambience</span>
          <Toggle
            checked={audio.ambienceEnabled}
            onChange={(v) => setAudio((p) => ({ ...p, ambienceEnabled: v }))}
            tint="#8FFFE6"
          />
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span style={{ color: "var(--text)" }}>Roses mode</span>
          <Toggle
            checked={audio.rosesEnabled}
            onChange={(v) => setAudio((p) => ({ ...p, rosesEnabled: v }))}
            tint="#B99CFF"
          />
        </div>

        <label className="block text-[11.5px]" style={{ color: "var(--text-soft)" }}>
          <div className="flex justify-between mb-1">
            <span>Master volume</span>
            <span className="mono" style={{ color: "var(--text)" }}>
              {Math.round(audio.masterVolume * 100)}%
            </span>
          </div>
          <input
            className="w-full"
            type="range" min="0" max="1" step="0.01"
            value={audio.masterVolume}
            onChange={(e) => setAudio((p) => ({ ...p, masterVolume: Number(e.target.value) }))}
          />
        </label>
      </div>

      {rosesMissing && !rosesUserUrl && (
        <div
          className="mt-3 rounded-xl p-3 text-[10.5px] leading-relaxed"
          style={{
            background: "rgba(185,156,255,0.06)",
            border: "1px solid rgba(185,156,255,0.2)",
            color: "var(--lavender)",
          }}
        >
          Roses mode is enabled, but no local audio asset was found. Add a file at
          <code className="mx-1 mono" style={{ color: "#E2D6FF" }}>
            /public/audio/roses-imanbek-local.mp3
          </code>
          or upload one:
          <label
            className="mt-2 block cursor-pointer rounded-lg px-2 py-1.5 text-center transition-colors"
            style={{
              border: "1px solid rgba(185,156,255,0.3)",
              color: "var(--lavender)",
            }}
          >
            upload roses audio
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={handleUserRosesUpload}
            />
          </label>
        </div>
      )}
      {ambienceMissing && (
        <div
          className="mt-2 text-[10.5px] italic"
          style={{ color: "var(--text-mute)" }}
        >
          Ocean ambience not found — add /public/audio/ocean-ambience.mp3 for the full reef.
        </div>
      )}
    </section>
  );
}
