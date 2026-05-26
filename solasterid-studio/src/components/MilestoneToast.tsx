import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MILESTONES: Record<number, { message: string; emoji: string; color: string }> = {
  10: { message: "10 arms. The reef stirs.", emoji: "🌊", color: "#8FFFE6" },
  20: { message: "20 arms. Old Flash game energy.", emoji: "🎮", color: "#C8B0E8" },
  30: { message: "30 arms. Full cognitive reef rave.", emoji: "🪸", color: "#F5A3A3" },
  50: { message: "50 arms. Capped. Powerful. Not physically illegal.", emoji: "🔱", color: "#FFE3A6" },
  75: { message: "75 arms. The fossil record grows heavy.", emoji: "⚗️", color: "#B0D8E8" },
  100: { message: "100 arms. It has become a reef.", emoji: "🌐", color: "#A8E6B2" },
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
              className="rounded-2xl px-5 py-3 text-[13.5px] font-display font-semibold shadow-2xl"
              style={{
                background: "rgba(11,23,38,0.92)",
                border: `1.5px solid ${m.color}55`,
                color: m.color,
                boxShadow: `0 8px 28px rgba(0,0,0,0.45), 0 0 28px ${m.color}24`,
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                letterSpacing: "0.01em",
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
