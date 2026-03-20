import Link from "next/link";
import type { PolicyDetail, PolicyListItem } from "@/lib/help/public";
import { EditorialPreviewBanner } from "./editorial-preview-banner";

interface PolicyDetailPageViewProps {
  policy: PolicyDetail;
  relatedPolicies: PolicyListItem[];
  preview?: {
    status: "draft" | "published" | "archived";
    backHref: string;
  };
}

export function PolicyDetailPageView({
  policy,
  relatedPolicies,
  preview,
}: PolicyDetailPageViewProps) {
  return (
    <section className="container-shell py-16">
      {preview ? (
        <EditorialPreviewBanner
          title={policy.title}
          status={preview.status}
          backHref={preview.backHref}
          message="La preview editorial muestra la policy con la misma composicion visual publica sin volverla visible al buyer hasta publicarla."
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
        <Link href={preview ? "/admin/editorial" : "/policies"} className="hover:text-white">
          Policies
        </Link>
        <span>/</span>
        <span className="text-white">{policy.title}</span>
      </div>

      <div className="mt-8 grid gap-10 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-soft)]">
            {policy.audience}
          </p>
          <h1 className="mt-4 text-4xl font-bold text-white">{policy.title}</h1>
          <p className="mt-4 text-lg text-[var(--text-soft)]">
            {policy.summary || "Policy publica del marketplace."}
          </p>

          <div className="mt-5 text-sm text-[var(--text-soft)]">
            Publicada:{" "}
            <span className="text-white">
              {policy.published_at
                ? new Date(policy.published_at).toLocaleDateString("es-ES")
                : "Sin fecha"}
            </span>
          </div>

          <div className="mt-8 whitespace-pre-wrap text-[var(--text-soft)]">{policy.body}</div>
        </article>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Rutas relacionadas</h2>
            <div className="mt-4 space-y-3">
              <Link
                href="/orders"
                className="block rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white transition hover:border-white/20"
              >
                Pedidos
              </Link>
              <Link
                href="/licenses"
                className="block rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white transition hover:border-white/20"
              >
                Licencias
              </Link>
              <Link
                href="/support"
                className="block rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white transition hover:border-white/20"
              >
                Soporte
              </Link>
              <Link
                href="/disputes"
                className="block rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white transition hover:border-white/20"
              >
                Disputas
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Policies relacionadas</h2>
            {relatedPolicies.length > 0 ? (
              <div className="mt-4 space-y-3">
                {relatedPolicies.map((related) => (
                  <Link
                    key={related.id}
                    href={preview ? `/admin/editorial/policies/${related.id}/preview` : `/policies/${related.policy_key}`}
                    className="block rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-white/20"
                  >
                    <p className="font-semibold text-white">{related.title}</p>
                    <p className="mt-2 text-sm text-[var(--text-soft)]">
                      {related.summary || "Policy relacionada."}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-[var(--text-soft)]">
                No hay policies relacionadas publicadas todavia.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
