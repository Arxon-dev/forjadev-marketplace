import Link from "next/link";
import { EditorialQuickActions } from "@/components/admin/editorial-quick-actions";
import { EditorialStatusPill } from "@/components/admin/editorial-status-pill";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

interface EditorialPageProps {
  searchParams?: Promise<{ status?: string }>;
}

type EditorialStatus = "draft" | "published" | "archived";
type HelpCategoryRow = Pick<
  Database["public"]["Tables"]["help_center_categories"]["Row"],
  "id" | "title" | "slug" | "description" | "sort_order" | "status" | "updated_at"
>;
type HelpArticleRow = Pick<
  Database["public"]["Tables"]["help_center_articles"]["Row"],
  | "id"
  | "title"
  | "slug"
  | "status"
  | "audience"
  | "article_type"
  | "is_featured"
  | "updated_at"
> & {
  category: { title: string } | { title: string }[] | null;
};
type PolicyRow = Pick<
  Database["public"]["Tables"]["marketplace_policy_pages"]["Row"],
  "id" | "title" | "policy_key" | "status" | "audience" | "updated_at"
>;

function normalizeStatus(value: string | undefined) {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }

  return "all";
}

export default async function AdminEditorialPage({ searchParams }: EditorialPageProps) {
  await requireAdminContext();
  const adminSupabase = createAdminClient();
  const params = (await searchParams) || {};
  const selectedStatus = normalizeStatus(params.status);

  const [categoriesResult, articlesResult, policiesResult] = await Promise.all([
    (() => {
      let query = adminSupabase
        .from("help_center_categories")
        .select("id, title, slug, description, sort_order, status, updated_at")
        .order("sort_order", { ascending: true });

      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
      }

      return query;
    })(),
    (() => {
      let query = adminSupabase
        .from("help_center_articles")
        .select("id, title, slug, status, audience, article_type, is_featured, updated_at, category:help_center_categories(title)")
        .order("updated_at", { ascending: false });

      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
      }

      return query.limit(12);
    })(),
    (() => {
      let query = adminSupabase
        .from("marketplace_policy_pages")
        .select("id, title, policy_key, status, audience, updated_at")
        .order("updated_at", { ascending: false });

      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
      }

      return query.limit(12);
    })(),
  ]);

  const categories = (categoriesResult.data || []) as HelpCategoryRow[];
  const articles = (articlesResult.data || []) as HelpArticleRow[];
  const policies = (policiesResult.data || []) as PolicyRow[];

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Admin</p>
            <h1 className="mt-3 text-4xl font-bold text-white">Editorial Ops</h1>
            <p className="mt-3 max-w-3xl text-[var(--text-soft)]">
              Gestiona help center y marketplace policies con estados editoriales reales, slugs
              controlados y publicacion segura.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin">
              <Button variant="secondary">Volver a admin</Button>
            </Link>
            <Link href="/admin/editorial/categories/new">
              <Button variant="secondary">Nueva categoria</Button>
            </Link>
            <Link href="/admin/editorial/articles/new">
              <Button variant="secondary">Nuevo articulo</Button>
            </Link>
            <Link href="/admin/editorial/policies/new">
              <Button>Nueva policy</Button>
            </Link>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-3">
          <Link href="/admin/editorial">
            <Button variant={selectedStatus === "all" ? "primary" : "secondary"}>Todos</Button>
          </Link>
          <Link href="/admin/editorial?status=draft">
            <Button variant={selectedStatus === "draft" ? "primary" : "secondary"}>Draft</Button>
          </Link>
          <Link href="/admin/editorial?status=published">
            <Button variant={selectedStatus === "published" ? "primary" : "secondary"}>
              Published
            </Button>
          </Link>
          <Link href="/admin/editorial?status=archived">
            <Button variant={selectedStatus === "archived" ? "primary" : "secondary"}>
              Archived
            </Button>
          </Link>
        </div>

        <div className="grid gap-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Categorias</h2>
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  Ordenan el help center publico y definen la jerarquia editorial.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <article
                    key={category.id}
                    className="rounded-2xl border border-white/10 bg-black/10 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{category.title}</h3>
                        <div className="mt-3">
                          <EditorialStatusPill status={category.status as EditorialStatus} />
                        </div>
                        <p className="mt-2 text-sm text-[var(--text-soft)]">
                          {category.description || "Sin descripcion."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--text-soft)]">
                          <span>Slug: {category.slug}</span>
                          <span>Orden: {category.sort_order}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Link href={`/admin/editorial/categories/${category.id}`}>
                          <Button variant="secondary">Editar</Button>
                        </Link>
                        <EditorialQuickActions
                          entity="categories"
                          entityId={category.id}
                          currentStatus={category.status as EditorialStatus}
                        />
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center text-[var(--text-soft)]">
                  No hay categorias en este filtro.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Articulos</h2>
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  Contenido publico reusable para compra, postventa y confianza.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {articles.length > 0 ? (
                articles.map((article) => {
                  const category = Array.isArray(article.category) ? article.category[0] : article.category;
                  return (
                    <article key={article.id} className="rounded-2xl border border-white/10 bg-black/10 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-semibold text-white">{article.title}</h3>
                            <EditorialStatusPill status={article.status} />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--text-soft)]">
                            <span>Slug: {article.slug}</span>
                            <span>Categoria: {category?.title || "Sin categoria"}</span>
                            <span>Audience: {article.audience}</span>
                            <span>Tipo: {article.article_type}</span>
                            {article.is_featured ? <span>Destacado</span> : null}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Link href={`/admin/editorial/articles/${article.id}`}>
                            <Button variant="secondary">Editar</Button>
                          </Link>
                          <EditorialQuickActions
                            entity="articles"
                            entityId={article.id}
                            currentStatus={article.status}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center text-[var(--text-soft)]">
                  No hay articulos en este filtro.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Policies</h2>
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  Reglas globales del marketplace separadas de las politicas del seller.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {policies.length > 0 ? (
                policies.map((policy) => (
                  <article key={policy.id} className="rounded-2xl border border-white/10 bg-black/10 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold text-white">{policy.title}</h3>
                          <EditorialStatusPill status={policy.status} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--text-soft)]">
                          <span>Key: {policy.policy_key}</span>
                          <span>Audience: {policy.audience}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Link href={`/admin/editorial/policies/${policy.id}`}>
                          <Button variant="secondary">Editar</Button>
                        </Link>
                        <EditorialQuickActions
                          entity="policies"
                          entityId={policy.id}
                          currentStatus={policy.status}
                        />
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center text-[var(--text-soft)]">
                  No hay policies en este filtro.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
