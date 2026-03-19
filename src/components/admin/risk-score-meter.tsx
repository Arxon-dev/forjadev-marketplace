import { cn } from "@/lib/cn";

interface RiskScoreMeterProps {
  score: number;
  label?: string;
  compact?: boolean;
}

function getRiskTone(score: number) {
  if (score >= 70) {
    return {
      text: "text-rose-200",
      track: "bg-rose-500/20",
      fill: "bg-rose-400",
      badge: "border-rose-500/30 bg-rose-500/10 text-rose-200",
      label: "Alto",
    };
  }

  if (score >= 35) {
    return {
      text: "text-amber-200",
      track: "bg-amber-500/20",
      fill: "bg-amber-300",
      badge: "border-amber-500/30 bg-amber-500/10 text-amber-200",
      label: "Medio",
    };
  }

  return {
    text: "text-emerald-200",
    track: "bg-emerald-500/20",
    fill: "bg-emerald-300",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    label: "Bajo",
  };
}

export function RiskScoreMeter({ score, label = "Risk score", compact = false }: RiskScoreMeterProps) {
  const tone = getRiskTone(score);

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-sm", compact ? "text-xs text-[var(--text-soft)]" : "text-[var(--text-soft)]")}>
          {label}
        </p>
        <div className={cn("rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]", tone.badge)}>
          {tone.label}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <p className={cn("font-bold", compact ? "text-lg" : "text-2xl", tone.text)}>{score}</p>
        <div className={cn("h-2.5 flex-1 overflow-hidden rounded-full", tone.track)}>
          <div
            className={cn("h-full rounded-full", tone.fill)}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
