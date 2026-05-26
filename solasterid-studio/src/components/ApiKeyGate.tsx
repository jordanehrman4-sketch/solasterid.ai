import { useState } from "react";
import { motion } from "framer-motion";

type Props = { onApiKeyReady: (key: string) => void };

// Tiny animated star/starfish SVG for the gate
function StarfishLogo() {
  return (
    <motion.svg viewBox="0 0 80 80" width="80" height="80" className="mx-auto mb-6">
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const x2 = 40 + Math.cos(angle) * 32;
        const y2 = 40 + Math.sin(angle) * 32;
        const cpx = 40 + Math.cos(angle) * 16 + Math.cos(angle + 1.2) * 8;
        const cpy = 40 + Math.sin(angle) * 16 + Math.sin(angle + 1.2) * 8;
        const colors = ["#7dd3fc", "#5eead4", "#f0abfc", "#fb7185", "#fde68a"];
        return (
          <motion.path
            key={i}
            d={`M 40 40 Q ${cpx} ${cpy} ${x2} ${y2}`}
            stroke={colors[i]}
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
            animate={{ strokeOpacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
          />
        );
      })}
      <motion.circle
        cx="40" cy="40" r="12"
        fill="#0a1628"
        stroke="#0d9488"
        strokeWidth="2.5"
        animate={{ r: [11, 14, 11] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <text x="40" y="43" textAnchor="middle" fill="#67e8f9" fontSize="7" fontWeight="bold">spkr</text>
    </motion.svg>
  );
}

export function ApiKeyGate({ onApiKeyReady }: Props) {
  const [draftKey, setDraftKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  function submit() {
    const trimmed = draftKey.trim();
    if (!trimmed) return;
    onApiKeyReady(trimmed);
    setDraftKey("");
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{
        background: "linear-gradient(180deg, #050d1a 0%, #061428 50%, #0a1410 100%)",
      }}
    >
      {/* Floating bubbles in background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: 10 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-cyan-300/20"
            style={{
              left: (8 + i * 9) + "%",
              bottom: "-20px",
              width: 4 + (i % 5) * 3,
              height: 4 + (i % 5) * 3,
              background: "radial-gradient(circle at 30% 30%, rgba(103,232,249,0.2), transparent)",
            }}
            animate={{ y: [0, -window.innerHeight * 0.95], opacity: [0.5, 0] }}
            transition={{ duration: 8 + i * 1.5, delay: i * 0.9, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="glass-panel relative w-full max-w-md p-8 slide-in"
        style={{ border: "1px solid rgba(103,232,249,0.2)", boxShadow: "0 0 60px rgba(13,148,136,0.15)" }}
      >
        <StarfishLogo />

        <h1 className="text-center text-3xl font-bold text-glow-teal text-cyan-100 tracking-wide">
          Solasterid Studio
        </h1>

        <p className="mt-3 text-center text-sm text-slate-400 leading-relaxed">
          Grow your Solasterid for your purpose.<br />
          Tune the seed while it swims.<br />
          If it survives 25 rounds, you get to take it home.
        </p>

        <div className="mt-5 rounded-xl bg-slate-950/70 border border-cyan-300/10 p-3 text-xs text-slate-400 text-center leading-relaxed">
          Your key is used only for this session and is never stored by this app.<br />
          <span className="text-cyan-600 italic">The creature's fossil is saved. The user's API key is not.</span>
        </div>

        <label className="mt-6 block text-sm font-medium text-slate-300">
          OpenAI API key
          <div className="relative mt-2">
            <input
              type={showKey ? "text" : "password"}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="sk-..."
              className="w-full rounded-xl border border-cyan-200/15 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition-all focus:border-cyan-400/50 focus:shadow-[0_0_12px_rgba(103,232,249,0.2)]"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              tabIndex={-1}
            >
              {showKey ? "hide" : "peek"}
            </button>
          </div>
        </label>

        <motion.button
          whileHover={{ scale: 1.02, boxShadow: "0 0 24px rgba(103,232,249,0.4)" }}
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={!draftKey.trim()}
          className="mt-5 w-full rounded-xl py-3 font-bold text-slate-950 transition-all disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #67e8f9, #0d9488)" }}
        >
          Enter Studio
        </motion.button>

        <p className="mt-4 text-center text-[10px] text-slate-600">
          Key stays in RAM only. Never logged. Never exported. Never sent anywhere except the OpenAI API.
        </p>
      </motion.div>
    </div>
  );
}
