import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MILESTONES: Record<number, { message: string; emoji: string; color: string }> = {
  10: { message: "10 arms. The reef stirs.", emoji: "🌊", color: "#67e8f9" },
  20: { message: "20 arms. Old Flash game energy.", emoji: "🎮", color: "#f0abfc" },
  30: { message: "30 arms. Full cognitive reef rave.", emoji: "🪸", color: "#fb7185" },
  50: { message: "50 arms. Capped. Powerful. Not physically illegal.", emoji: "🔱", color: "#fde68a" },
  75: { message: "75 arms. The fossil record grows heavy.", emoji: "⚗️", color: "#c4b5fd" },
  100: { message: "100 arms. It has become a reef.", emoji: "🌐", color: "#5eead4" },
};

type Props = { activeArmCount: number };

type Toast = { id: number; milestone: number };

export function MilestoneToast({ activeArmCount }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [fired, setFired] = useState<Set<number>>(new Set());

  useEffect(() => {
    const thresholds = Object.keys(MILESTONES).map(Number).sort((a, b) => a - b);
    for (const t of thresholds) {
      if (activeArmCount >= t && !fired.has(t)) {
        setFired((prev) => new Set([...prev, t]));
        const id = Date.now() + t;
        setToasts((prev) => [...prev, { id, milestone: t }]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 4500);
      }
    }
  }, [activeArmCount, fired]);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const m = MILESTONES[toast.milestone];
          if (!m) return null;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 24, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.9 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="rounded-2xl px-5 py-3 text-sm font-bold shadow-2xl"
              style={{
                background: `linear-gradient(135deg, rgba(5,13,26,0.95), rgba(10,22,40,0.95))`,
                border: `1px solid ${m.color}40`,
                color: m.color,
                boxShadow: `0 0 40px ${m.color}30`,
              }}
            >
              {m.emoji} {m.message}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
