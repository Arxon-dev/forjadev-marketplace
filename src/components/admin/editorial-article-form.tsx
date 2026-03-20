"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface EditorialArticleFormProps {
  categories: Array<{ id: string; title: string }>;
  products: Array<{ id: string; title: string }>;
  article?: {
    id: string;
    category_id: string;
    related_product_id: string | null;
    article_type: "guide" | "policy" | "faq" | "troubleshooting" | "post_sale";
    audience: "buyer" | "seller" | "shared";
    slug: string;
    title: string;
    summary: string | null;
    body: string;
    status: "draft" | "published" | "archived";
    is_featured: boolean;
    sort_order: number;
    seo_title: string | null;
    seo_description: string | null;
    review_notes: string | null;
  } | null;
}

export function EditorialArticleForm({
  categories,
  products,
  article = null,
}: EditorialArticleFormProps) {
  const router = useRouter();
  const slugLocked = article?.status === "published";
  const [form, setForm] = useState({
    categoryId: article?.category_id || categories[0]?.id || "",
    relatedProductId: article?.related_product_id || "",
    articleType: article?.article_type || "guide",
    audience: article?.audience || "buyer",
    slug: article?.slug || "",
    title: article?.title || "",
    summary: article?.summary || "",
    body: article?.body || "",
    status: article?.status || "draft",
    isFeatured: article?.is_featured || false,
    sortOrder: String(article?.sort_order ?? 0),
    seoTitle: article?.seo_title || "",
    seoDescription: article?.seo_description || "",
    reviewNotes: article?.review_notes || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateForm = (field: string, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        article ? `/api/admin/editorial/articles/${article.id}` : "/api/admin/editorial/articles",
        {
          method: article ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const payload = (await response.json().catch(() => null)) as
        | { id?: string; message?: string }
        | null;

      if (!response.ok || !payload?.id) {
        throw new Error(payload?.message || "No se pudo guardar el articulo.");
      }

      router.push(`/admin/editorial/articles/${payload.id}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "No se pudo guardar el articulo."
      );
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold text-white">
        {article ? "Editar articulo" : "Nuevo articulo"}
      </h2>

      {article ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/admin/editorial/articles/${article.id}/preview`}>
            <Button type="button" variant="secondary">
              Preview
            </Button>
          </Link>
        </div>
      ) : null}

      {slugLocked ? (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Este articulo esta publicado. El slug queda bloqueado para no romper rutas ya
          indexadas o enlazadas desde help, producto o footer. Primero debes retirarlo a draft o
          archived si necesitas renombrarlo.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-white">Titulo *</label>
          <input value={form.title} onChange={(e) => updateForm("title", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Slug *</label>
          <input value={form.slug} onChange={(e) => updateForm("slug", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading || slugLocked} />
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Categoria *</label>
          <select value={form.categoryId} onChange={(e) => updateForm("categoryId", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Producto relacionado</label>
          <select value={form.relatedProductId} onChange={(e) => updateForm("relatedProductId", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading}>
            <option value="">Sin relacion</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Tipo</label>
          <select value={form.articleType} onChange={(e) => updateForm("articleType", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading}>
            <option value="guide">Guide</option>
            <option value="policy">Policy</option>
            <option value="faq">FAQ</option>
            <option value="troubleshooting">Troubleshooting</option>
            <option value="post_sale">Post sale</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Audience</label>
          <select value={form.audience} onChange={(e) => updateForm("audience", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading}>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="shared">Shared</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Estado</label>
          <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Orden</label>
          <input type="number" value={form.sortOrder} onChange={(e) => updateForm("sortOrder", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading} />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-white">Resumen *</label>
        <textarea value={form.summary} onChange={(e) => updateForm("summary", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" rows={3} disabled={loading} />
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-white">Contenido *</label>
        <textarea value={form.body} onChange={(e) => updateForm("body", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" rows={10} disabled={loading} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-white">SEO title</label>
          <input value={form.seoTitle} onChange={(e) => updateForm("seoTitle", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-white">SEO description</label>
          <textarea value={form.seoDescription} onChange={(e) => updateForm("seoDescription", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" rows={3} disabled={loading} />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-white">Review notes</label>
        <textarea value={form.reviewNotes} onChange={(e) => updateForm("reviewNotes", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" rows={3} disabled={loading} />
      </div>

      <label className="mt-4 flex items-center gap-3 text-sm text-white">
        <input type="checkbox" checked={form.isFeatured} onChange={(e) => updateForm("isFeatured", e.target.checked)} disabled={loading} />
        Articulo destacado
      </label>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      <Button type="submit" className="mt-6 w-full" disabled={loading}>
        {loading ? "Guardando..." : "Guardar articulo"}
      </Button>
    </form>
  );
}
