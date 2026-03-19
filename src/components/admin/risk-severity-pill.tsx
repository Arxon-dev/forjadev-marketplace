import { cn } from "@/lib/cn";

interface RiskSeverityPillProps {
  severity: "low" | "medium" | "high";
}

const toneBySeverity = {
  low: "border-sky-500/30 bg-sky-500/10 text-sky-100",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  high: "border-red-500/30 bg-red-500/10 text-red-100",
} as const;

export function RiskSeverityPill({ severity }: RiskSeverityPillProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
        toneBySeverity[severity]
      )}
    >
      {severity}
    </span>
  );
}
