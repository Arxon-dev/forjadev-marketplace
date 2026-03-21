import Link from "next/link";
import type { ProductCommerceHelpContext } from "@/lib/help/public";

interface ProductCommerceHelpPanelProps {
  context: ProductCommerceHelpContext;
}

function audienceLabel(value: "buyer" | "seller" | "shared") {
  if (value === "buyer") return "Buyer";
  if (value === "seller") return "Seller";
  return "Marketplace";
}

export function ProductCommerceHelpPanel({
  context,
}: ProductCommerceHelpPanelProps) {
  return (
    <div
      className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6"
      data-commerce-help="product"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
            Compra con contexto
          </p>
          <h2 className="mt-3 text-xl font-semibold text-white">
            Ayuda publica y reglas utiles antes de comprar
          </h2>
          <p className="mt-3 text-sm text-[var(--text-soft)]">
            Esta capa conecta dudas frecuentes, guias publicas y policies del marketplace
            justo en el punto de decision comercial.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/help"
            className="inline-flex rounded-2xl border border-white/10 bg-black/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Abrir help center
          </Link>
          <Link
            href="/policies"
            className="inline-flex rounded-2xl border border-white/10 bg-black/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Ver policies
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div>
          <h3 className="text-base font-semibold text-white">Ayuda relacionada</h3>
          <div className="mt-4 space-y-3">
            {context.articles.length > 0 ? (
              context.articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/help/article/${article.slug}`}
                  className="block rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-white/20"
                  data-commerce-help-article={article.slug}
                >
                  <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    <span>{article.category.title}</span>
                    <span>{audienceLabel(article.audience)}</span>
                    <span>{article.article_type}</span>
                  </div>
                  <p className="mt-3 font-semibold text-white">{article.title}</p>
                  <p className="mt-2 text-sm text-[var(--text-soft)]">
                    {article.summary || "Guia publica para reducir dudas antes de comprar."}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-[var(--text-soft)]">
                  Aun no hay articulos publicados para este contexto comercial.
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-white">Policies aplicables</h3>
          <div className="mt-4 space-y-3">
            {context.policies.length > 0 ? (
              context.policies.map((policy) => (
                <Link
                  key={policy.id}
                  href={`/policies/${policy.policy_key}`}
                  className="block rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-white/20"
                  data-commerce-help-policy={policy.policy_key}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    {audienceLabel(policy.audience)}
                  </div>
                  <p className="mt-3 font-semibold text-white">{policy.title}</p>
                  <p className="mt-2 text-sm text-[var(--text-soft)]">
                    {policy.summary || "Policy publica del marketplace."}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-[var(--text-soft)]">
                  Aun no hay policies publicas orientadas a esta decision de compra.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
