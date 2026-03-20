"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface EditorialPolicyFormProps {
  policy?: {
    id: string;
    policy_key: string;
    title: string;
    summary: string | null;
    body: string;
    audience: "buyer" | "seller" | "shared";
    status: "draft" | "published" | "archived";
    sort_order: number;
    seo_title: string | null;
    seo_description: string | null;
    review_notes: string | null;
  } | null;
}

export function EditorialPolicyForm({ policy = null }: EditorialPolicyFormProps) {
  const router = useRouter();
  const keyLocked = policy?.status === "published";
  const [form, setForm] = useState({
    policyKey: policy?.policy_key || "",
    title: policy?.title || "",
    summary: policy?.summary || "",
    body: policy?.body || "",
    audience: policy?.audience || "shared",
    status: policy?.status || "draft",
    sortOrder: String(policy?.sort_order ?? 0),
    seoTitle: policy?.seo_title || "",
    seoDescription: policy?.seo_description || "",
    reviewNotes: policy?.review_notes || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateForm = (field: string, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        policy ? `/api/admin/editorial/policies/${policy.id}` : "/api/admin/editorial/policies",
        {
          method: policy ? "PATCH" : "POST",
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
        throw new Error(payload?.message || "No se pudo guardar la policy.");
      }

      router.push(`/admin/editorial/policies/${payload.id}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "No se pudo guardar la policy."
      );
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold text-white">
        {policy ? "Editar policy" : "Nueva policy"}
      </h2>

      {policy ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/admin/editorial/policies/${policy.id}/preview`}>
            <Button type="button" variant="secondary">
              Preview
            </Button>
          </Link>
        </div>
      ) : null}

      {keyLocked ? (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Esta policy esta publicada. Su clave publica queda bloqueada para mantener estables las
          URLs del marketplace y evitar enlaces rotos en help, footer o documentacion.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-white">Titulo *</label>
          <input value={form.title} onChange={(e) => updateForm("title", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Clave publica *</label>
          <input value={form.policyKey} onChange={(e) => updateForm("policyKey", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading || keyLocked} />
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
          <label className="block text-sm font-medium text-white">Orden</label>
          <input type="number" value={form.sortOrder} onChange={(e) => updateForm("sortOrder", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-white">SEO title</label>
          <input value={form.seoTitle} onChange={(e) => updateForm("seoTitle", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" disabled={loading} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-white">SEO description</label>
          <textarea value={form.seoDescription} onChange={(e) => updateForm("seoDescription", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" rows={3} disabled={loading} />
        </div>
        <div>
          <label className="block text-sm font-medium text-white">Review notes</label>
          <textarea value={form.reviewNotes} onChange={(e) => updateForm("reviewNotes", e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white" rows={3} disabled={loading} />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      <Button type="submit" className="mt-6 w-full" disabled={loading}>
        {loading ? "Guardando..." : "Guardar policy"}
      </Button>
    </form>
  );
}
