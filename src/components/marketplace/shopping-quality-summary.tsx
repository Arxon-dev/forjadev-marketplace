import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ShoppingQualitySnapshot } from "@/lib/marketplace/quality-signals";

interface ShoppingQualitySummaryProps {
  snapshot: ShoppingQualitySnapshot;
  variant?: "compact" | "detail";
}

function toneClassName(tone: "primary" | "success" | "warning") {
  if (tone === "success") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }

  if (tone === "warning") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  }

  return "border-cyan-500/20 bg-cyan-500/10 text-cyan-100";
}

export function ShoppingQualitySummary({
  snapshot,
  variant = "compact",
}: ShoppingQualitySummaryProps) {
  if (variant === "compact") {
    return (
      <div className="mt-4 border-t border-white/10 pt-4" data-shopping-quality="compact">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
          {snapshot.headline}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {snapshot.signals.map((signal) => (
            <Badge
              key={signal.label}
              className={toneClassName(signal.tone)}
              data-quality-signal={signal.label}
            >
              {signal.label}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card className="p-6" data-shopping-quality="detail">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
        {snapshot.headline}
      </p>
      <p className="mt-3 text-sm text-[var(--text-soft)]">{snapshot.summary}</p>
      <div className="mt-5 space-y-3">
        {snapshot.signals.map((signal) => (
          <div
            key={signal.label}
            className="rounded-2xl border border-white/10 bg-black/10 p-4"
            data-quality-signal={signal.label}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={toneClassName(signal.tone)}>{signal.label}</Badge>
            </div>
            <p className="mt-3 text-sm text-[var(--text-soft)]">{signal.detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
