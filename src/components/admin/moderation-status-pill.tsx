interface ModerationStatusPillProps {
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "border-white/10 bg-white/5 text-white",
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  rejected: "border-red-500/30 bg-red-500/10 text-red-300",
  hidden: "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

export function ModerationStatusPill({ status }: ModerationStatusPillProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${
        STATUS_STYLES[status] || STATUS_STYLES.draft
      }`}
    >
      {status}
    </span>
  );
}
