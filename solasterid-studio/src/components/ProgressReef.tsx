/**
 * Compact gauge cluster shown above the canvas:
 *   - Export unlock (r→25)
 *   - Tempseed tide (rounds until next seed injection)
 *   - Architecture stats: active / fossils / committees
 */
import type { SolasteridState } from "../lib/solasteridState";

type Props = { state: SolasteridState };

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{
        background: "rgba(7,21,35,0.55)",
        border: "1px solid rgba(143,255,230,0.08)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: accent,
          boxShadow: `0 0 6px ${accent}`,
        }}
      />
      <span className="text-[10.5px] eyebrow" style={{ letterSpacing: "0.14em" }}>
        {label}
      </span>
      <span
        className="text-[12px] font-display font-semibold mono"
        style={{ color: "var(--text-strong)" }}
      >
        {value}
      </span>
    </div>
  );
}

function ProgressRow({
  label,
  caption,
  pct,
  variant = "cyan",
}: {
  label: string;
  caption: string;
  pct: number;
  variant?: "cyan" | "coral" | "plankton";
}) {
  const fillClass =
    variant === "coral"
      ? "progress-fill progress-fill--coral"
      : variant === "plankton"
      ? "progress-fill progress-fill--plankton"
      : "progress-fill";
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline">
        <span className="eyebrow">{label}</span>
        <span
          className="text-[10.5px] mono"
          style={{ color: "var(--text-soft)" }}
        >
          {caption}
        </span>
      </div>
      <div className="mt-1.5 progress-track">
        <div className={fillClass} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}

export function ProgressReef({ state }: Props) {
  const active = state.arms.filter((a) => a.status === "active").length;
  const retired = state.arms.filter((a) => a.status === "retired").length;
  const probation = state.arms.filter((a) => a.status === "probation").length;

  const round = state.round;
  const exportPct = Math.min(100, (round / 25) * 100);
  const exportRemaining = Math.max(0, 25 - round);

  // Next tempseed tide every 5 rounds (1, 5, 10, 15…). Compute rounds to next.
  const nextTide =
    round === 0 ? 1 : round % 5 === 0 ? round + 5 : Math.ceil((round + 1) / 5) * 5;
  const roundsToTide = Math.max(0, nextTide - round);
  const tidePct = Math.min(100, ((5 - roundsToTide) / 5) * 100);

  return (
    <section className="glass-panel" style={{ padding: 14 }}>
      <div className="flex flex-wrap items-center gap-2">
        <StatPill label="round" value={round} accent="#64F5E6" />
        <StatPill label="active" value={active} accent="#8FFFE6" />
        <StatPill label="fossil" value={retired} accent="#5A6E78" />
        {probation > 0 && (
          <StatPill label="probation" value={probation} accent="#B99CFF" />
        )}
        <StatPill label="committees" value={state.committees.length} accent="#FF9A76" />
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-4">
        <ProgressRow
          label="Take it home — export at r25"
          caption={
            state.exportUnlocked
              ? "unlocked · ready to take your Solasterid home"
              : `${exportRemaining} round${exportRemaining === 1 ? "" : "s"} to unlock`
          }
          pct={state.exportUnlocked ? 100 : exportPct}
          variant="coral"
        />
        <ProgressRow
          label="Tempseed tide"
          caption={
            roundsToTide === 0 ? "injecting now…" : `next in ${roundsToTide}`
          }
          pct={tidePct}
          variant="plankton"
        />
      </div>
    </section>
  );
}
