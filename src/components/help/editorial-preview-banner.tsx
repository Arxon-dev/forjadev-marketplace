import Link from "next/link";

interface EditorialPreviewBannerProps {
  title: string;
  status: "draft" | "published" | "archived";
  backHref: string;
  message: string;
}

const STATUS_LABELS = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
} as const;

export function EditorialPreviewBanner({
  title,
  status,
  backHref,
  message,
}: EditorialPreviewBannerProps) {
  return (
    <div className="mb-8 rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
            Preview editorial
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
          <p className="mt-2 text-sm text-amber-100/90">
            Estado actual: {STATUS_LABELS[status]}. {message}
          </p>
        </div>
        <Link
          href={backHref}
          className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Volver a edicion
        </Link>
      </div>
    </div>
  );
}
