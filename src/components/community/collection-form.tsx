"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { trackMarketplaceEvent } from "@/lib/analytics/marketplace";

interface CreatedCollection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  item_count: number;
}

interface CollectionFormProps {
  initialProductId?: string;
  compact?: boolean;
  onCreated?: (collection: CreatedCollection) => void;
}

export function CollectionForm({
  initialProductId,
  compact = false,
  onCreated,
}: CollectionFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("Debes indicar un titulo.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          isPublic,
          initialProductId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; collection?: CreatedCollection }
        | null;

      if (!response.ok || !payload?.collection) {
        throw new Error(payload?.message || "No se pudo crear la coleccion");
      }

      setSuccess("Coleccion creada correctamente");
      setTitle("");
      setDescription("");
      setIsPublic(true);
      onCreated?.(payload.collection);
      trackMarketplaceEvent({
        eventName: "collection.created",
        pageType: initialProductId ? "product_detail" : "dashboard",
        entityType: "collection",
        entityId: payload.collection.id,
        metadata: {
          isPublic,
          withInitialProduct: Boolean(initialProductId),
        },
      });
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear la coleccion"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-3xl border border-white/10 bg-white/5 ${
        compact ? "p-5" : "p-6"
      }`}
    >
      <h3 className="text-lg font-semibold text-white">Crear coleccion</h3>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Agrupa productos para compartir criterios, stacks recomendados o ideas de compra.
      </p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-white">Titulo</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="Por ejemplo: Stack esencial para un servidor modded"
            maxLength={80}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white">Descripcion</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="Explica por que has reunido estos productos."
            rows={compact ? 3 : 4}
            maxLength={500}
            disabled={submitting}
          />
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-[var(--text-soft)]">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-transparent"
            disabled={submitting}
          />
          Hacer publica esta coleccion para que aparezca en el marketplace
        </label>
      </div>

      <div className="mt-5">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creando..." : "Crear coleccion"}
        </Button>
      </div>
    </form>
  );
}
