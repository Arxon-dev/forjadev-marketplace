import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

interface EditorialStatusPillProps {
  status: "draft" | "published" | "archived";
}

const STATUS_STYLES = {
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  archived: "border-slate-500/30 bg-slate-500/10 text-slate-300",
} as const;

const STATUS_LABELS = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
} as const;

export function EditorialStatusPill({ status }: EditorialStatusPillProps) {
  return <Badge className={cn(STATUS_STYLES[status])}>{STATUS_LABELS[status]}</Badge>;
}
