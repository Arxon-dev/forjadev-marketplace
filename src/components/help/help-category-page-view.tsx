import Link from "next/link";
import type { HelpArticleListItem, HelpCategory, PolicyListItem } from "@/lib/help/public";
import { EditorialPreviewBanner } from "./editorial-preview-banner";

interface HelpCategoryPageViewProps {
  category: HelpCategory;
  articles: HelpArticleListItem[];
  policies: PolicyListItem[];
  preview?: {
    status: "draft" | "published" | "archived";
    backHref: string;
    categoryHref: string;
  };
}

export function HelpCategoryPageView({
  category,
  articles,
  policies,
  preview,
}: HelpCategoryPageViewProps) {
  const helpHref = preview ? "/admin/editorial" : "/help";
  const currentCategoryHref = preview?.categoryHref || `/help/${category.slug}`;

  return (
    <section className="container-shell py-16">
      {preview ? (
        <EditorialPreviewBanner
          title={category.title}
          status={preview.status}
          backHref={preview.backHref}
          message="Esta vista solo es visible para admin y refleja la composicion de la pagina antes de exponerla publicamente."
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
        <Link href={helpHref} className="hover:text-white">
          Help
        </Link>
        <span>/</span>
        <Link href={currentCategoryHref} className="text-white">
          {category.title}
        </Link>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-soft)]">
            {category.icon || "guide"}
          </p>
          <h1 className="mt-4 text-4xl font-bold text-white">{category.title}</h1>
          <p className="mt-4 max-w-2xl text-[var(--text-soft)]">
            {category.description || "Documentacion publica para esta area del marketplace."}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">Policies relacionadas</h2>
          <div className="mt-4 space-y-3">
            {policies.slice(0, 4).map((policy) => (
              <Link
                key={policy.id}
                href={`/policies/${policy.policy_key}`}
                className="block rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-white/20"
              >
                <p className="font-semibold text-white">{policy.title}</p>
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  {policy.summary || "Policy publica del marketplace."}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <section className="mt-12">
        {articles.length > 0 ? (
          <div className="grid gap-5">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={preview ? `/admin/editorial/articles/${article.id}/preview` : `/help/article/${article.slug}`}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20"
              >
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                    {article.article_type}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    {article.audience}
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-white">{article.title}</h2>
                <p className="mt-3 text-[var(--text-soft)]">
                  {article.summary || "Articulo publico para esta categoria."}
                </p>
                {article.relatedProduct ? (
                  <p className="mt-4 text-sm text-[var(--text-soft)]">
                    Relacionado con:{" "}
                    <span className="text-white">{article.relatedProduct.title}</span>
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-14 text-center">
            <p className="text-[var(--text-soft)]">
              Esta categoria ya esta preparada, pero todavia no tiene articulos publicados.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
