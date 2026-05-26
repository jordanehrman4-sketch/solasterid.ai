import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Lore + quick legend sheet. Triggered by the ℹ button in the top bar.
 * Leans into the Solasteridae naming joke and gives first-time users a
 * one-screen explanation of what they're looking at.
 */
export function AboutSheet({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(3,17,31,0.85)", backdropFilter: "blur(10px)" }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
            className="glass-panel glass-panel--strong w-full max-w-lg p-7"
            style={{ borderColor: "rgba(143,255,230,0.22)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow">About</div>
                <h2
                  className="mt-1 font-display font-semibold"
                  style={{ fontSize: 22, color: "var(--text-strong)" }}
                >
                  Solasterid Studio
                </h2>
              </div>
              <button
                onClick={onClose}
                className="btn btn-ghost"
                style={{ padding: "3px 10px", fontSize: 16, lineHeight: 1 }}
                aria-label="close"
              >
                ×
              </button>
            </div>

            {/* Lore */}
            <div
              className="mt-4 rounded-2xl px-4 py-3"
              style={{
                background: "rgba(143,255,230,0.05)",
                border: "1px solid rgba(143,255,230,0.16)",
              }}
            >
              <p
                className="text-[12.5px] leading-relaxed"
                style={{ color: "var(--text)" }}
              >
                <span
                  className="font-display font-semibold"
                  style={{ color: "var(--foam)" }}
                >
                  Solasteridae
                </span>{" "}
                <span
                  className="mono"
                  style={{ color: "var(--text-mute)", fontSize: 11 }}
                >
                  /ˌsoʊləˈstɛrɪdiː/
                </span>{" "}
                — the sun-star family of sea stars. Members typically have{" "}
                <span style={{ color: "var(--foam)" }}>8 to 16 arms</span>,
                more than the classical five-pointed starfish. They start with
                a pentagonal core and grow new arms as they mature.
              </p>
              <p
                className="mt-2 text-[12px] leading-relaxed italic"
                style={{ color: "var(--text-soft)" }}
              >
                So does the creature in this studio. Five committee arms at
                birth, more as the seed asks for them — pruned when redundant,
                fossilized when retired.
              </p>
            </div>

            {/* Quick legend */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <LegendCard
                title="Speakerbot"
                body="The dark mouth at the center. Aggregates the arms each round and decides what gets said."
                tint="#FFD166"
              />
              <LegendCard
                title="Arms"
                body="Specialist lenses (literalist, mechanic, dreamer, adversary, verifier, …). They grow, sometimes go on probation, sometimes fossilize."
                tint="#A8E6B2"
              />
              <LegendCard
                title="Committees"
                body="Sectors of related arms. The creature self-organizes them as it discovers patterns in its work."
                tint="#C8B0E8"
              />
              <LegendCard
                title="Tempseed tide"
                body="Every 5 rounds the current seed is re-injected as a recurrent growth signal. Edit it any time."
                tint="#8FFFE6"
              />
              <LegendCard
                title="Autopilot"
                body="The creature runs round after round on its own. Pause whenever — your tempseed edits land on the next round."
                tint="#FF9A76"
              />
              <LegendCard
                title="Fossil at r25"
                body="Survive 25 rounds and the export unlocks. The creature's fossil is saved. Your API key is not."
                tint="#FF6F91"
              />
            </div>

            {/* Tips */}
            <p
              className="mt-4 text-[11.5px] leading-relaxed italic"
              style={{ color: "var(--text-mute)" }}
            >
              The creature only does what the seed asks for. If you want
              precision, ask for it. If you want web-search-backed facts, ask
              for it. If you want it weirder, ask. If you want it to prune
              itself, ask.
            </p>

            <div className="mt-5 flex justify-end">
              <button onClick={onClose} className="btn btn-primary" style={{ padding: "9px 18px" }}>
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LegendCard({
  title,
  body,
  tint,
}: {
  title: string;
  body: string;
  tint: string;
}) {
  return (
    <div
      className="rounded-2xl px-3 py-2.5"
      style={{
        background: "rgba(7,21,35,0.55)",
        border: "1px solid rgba(143,255,230,0.08)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: tint,
            boxShadow: `0 0 6px ${tint}`,
          }}
        />
        <span
          className="font-display font-semibold text-[12px]"
          style={{ color: "var(--text-strong)" }}
        >
          {title}
        </span>
      </div>
      <p
        className="mt-1 text-[11px] leading-relaxed"
        style={{ color: "var(--text-soft)" }}
      >
        {body}
      </p>
    </div>
  );
}
