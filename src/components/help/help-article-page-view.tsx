import Link from "next/link";
import type { HelpArticleDetail, HelpArticleListItem } from "@/lib/help/public";
import { EditorialPreviewBanner } from "./editorial-preview-banner";

interface HelpArticlePageViewProps {
  article: HelpArticleDetail;
  relatedArticles: HelpArticleListItem[];
  preview?: {
    status: "draft" | "published" | "archived";
    backHref: string;
    categoryHref: string;
  };
}

export function HelpArticlePageView({
  article,
  relatedArticles,
  preview,
}: HelpArticlePageViewProps) {
  const helpHref = preview ? "/admin/editorial" : "/help";
  const categoryHref = preview?.categoryHref || `/help/${article.category.slug}`;

  return (
    <section className="container-shell py-16">
      {preview ? (
        <EditorialPreviewBanner
          title={article.title}
          status={preview.status}
          backHref={preview.backHref}
          message="Esta previsualizacion usa la misma estructura visual de la pagina publica sin exponer el articulo fuera del panel admin."
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
        <Link href={helpHref} className="hover:text-white">
          Help
        </Link>
        <span>/</span>
        <Link href={categoryHref} className="hover:text-white">
          {article.category.title}
        </Link>
        <span>/</span>
        <span className="text-white">{article.title}</span>
      </div>

      <div className="mt-8 grid gap-10 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
              {article.article_type}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              {article.audience}
            </span>
          </div>

          <h1 className="mt-5 text-4xl font-bold text-white">{article.title}</h1>
          <p className="mt-4 text-lg text-[var(--text-soft)]">
            {article.summary || "Guia publica para orientar a buyer y seller dentro del marketplace."}
          </p>

          <div className="mt-5 flex flex-wrap gap-4 text-sm text-[var(--text-soft)]">
            <span>
              Categoria: <span className="text-white">{article.category.title}</span>
            </span>
            <span>
              Actualizado:{" "}
              <span className="text-white">
                {new Date(article.updated_at).toLocaleDateString("es-ES")}
              </span>
            </span>
          </div>

          <div className="mt-8 whitespace-pre-wrap text-[var(--text-soft)]">{article.body}</div>
        </article>

        <aside className="space-y-6">
          {article.relatedProduct ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Producto relacionado</h2>
              <p className="mt-4 text-[var(--text-soft)]">{article.relatedProduct.title}</p>
              <Link
                href={`/products/${article.relatedProduct.slug}`}
                className="mt-5 inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ver producto
              </Link>
            </div>
          ) : null}

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Siguiente accion</h2>
            <div className="mt-4 space-y-3">
              <Link
                href="/support"
                className="block rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white transition hover:border-white/20"
              >
                Abrir soporte privado
              </Link>
              <Link
                href="/policies"
                className="block rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white transition hover:border-white/20"
              >
                Revisar policies del marketplace
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Mas en esta categoria</h2>
            {relatedArticles.length > 0 ? (
              <div className="mt-4 space-y-3">
                {relatedArticles.map((related) => (
                  <Link
                    key={related.id}
                    href={preview ? `/admin/editorial/articles/${related.id}/preview` : `/help/article/${related.slug}`}
                    className="block rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-white/20"
                  >
                    <p className="font-semibold text-white">{related.title}</p>
                    <p className="mt-2 text-sm text-[var(--text-soft)]">
                      {related.summary || "Articulo relacionado."}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-[var(--text-soft)]">
                No hay mas articulos relacionados todavia.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
