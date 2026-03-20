"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface EditorialCategoryFormProps {
  category?: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    icon: string | null;
    sort_order: number;
    status: "draft" | "published" | "archived";
  } | null;
}

export function EditorialCategoryForm({ category = null }: EditorialCategoryFormProps) {
  const router = useRouter();
  const slugLocked = category?.status === "published";
  const [title, setTitle] = useState(category?.title || "");
  const [slug, setSlug] = useState(category?.slug || "");
  const [description, setDescription] = useState(category?.description || "");
  const [icon, setIcon] = useState(category?.icon || "");
  const [sortOrder, setSortOrder] = useState(String(category?.sort_order ?? 0));
  const [status, setStatus] = useState(category?.status || "draft");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        category ? `/api/admin/editorial/categories/${category.id}` : "/api/admin/editorial/categories",
        {
          method: category ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            slug,
            description,
            icon,
            sortOrder,
            status,
          }),
        }
      );

      const payload = (await response.json().catch(() => null)) as
        | { id?: string; message?: string }
        | null;

      if (!response.ok || !payload?.id) {
        throw new Error(payload?.message || "No se pudo guardar la categoria.");
      }

      router.push(`/admin/editorial/categories/${payload.id}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "No se pudo guardar la categoria."
      );
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold text-white">
        {category ? "Editar categoria" : "Nueva categoria"}
      </h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Las categorias ordenan el help center publico y controlan la jerarquia editorial.
      </p>

      {category ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/admin/editorial/categories/${category.id}/preview`}>
            <Button type="button" variant="secondary">
              Preview
            </Button>
          </Link>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {slugLocked ? (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Esta categoria esta publicada. Su slug queda bloqueado para no romper enlaces
          publicos. Si necesitas cambiarlo, pasa primero el contenido a draft o archived.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-white">Titulo *</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white"
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Slug *</label>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white"
            disabled={loading || slugLocked}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Icono</label>
          <input
            value={icon}
            onChange={(event) => setIcon(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white"
            disabled={loading}
            placeholder="life-buoy"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Orden</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white"
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Estado</label>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "draft" | "published" | "archived")
            }
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white"
            disabled={loading}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-white">Descripcion</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white"
          rows={4}
          disabled={loading}
        />
      </div>

      <Button type="submit" className="mt-6 w-full" disabled={loading}>
        {loading ? "Guardando..." : "Guardar categoria"}
      </Button>
    </form>
  );
}
