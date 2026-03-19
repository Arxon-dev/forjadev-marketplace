"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CollectionForm } from "@/components/community/collection-form";
import { Button } from "@/components/ui/button";
import { trackMarketplaceEvent } from "@/lib/analytics/marketplace";

interface UserCollection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  isIncluded: boolean;
}

interface ProductCollectionButtonProps {
  productId: string;
  initialCollections: UserCollection[];
}

export function ProductCollectionButton({
  productId,
  initialCollections,
}: ProductCollectionButtonProps) {
  const router = useRouter();
  const [collections, setCollections] = useState(initialCollections);
  const [busyCollectionId, setBusyCollectionId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(initialCollections.length === 0);
  const [error, setError] = useState("");

  const includedCount = useMemo(
    () => collections.filter((collection) => collection.isIncluded).length,
    [collections]
  );

  const toggleProduct = async (collectionId: string, isIncluded: boolean) => {
    setError("");
    setBusyCollectionId(collectionId);

    setCollections((current) =>
      current.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              isIncluded: !isIncluded,
              itemCount: Math.max(0, collection.itemCount + (isIncluded ? -1 : 1)),
            }
          : collection
      )
    );

    try {
      const response = await fetch(`/api/collections/${collectionId}/items`, {
        method: isIncluded ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productId }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo actualizar la coleccion");
      }

      trackMarketplaceEvent({
        eventName: "collection.item.toggled",
        pageType: "product_detail",
        entityType: "collection",
        entityId: collectionId,
        metadata: {
          productId,
          action: isIncluded ? "removed" : "added",
        },
      });
      router.refresh();
    } catch (toggleError) {
      setCollections((current) =>
        current.map((collection) =>
          collection.id === collectionId
            ? {
                ...collection,
                isIncluded,
                itemCount: Math.max(0, collection.itemCount + (isIncluded ? 1 : -1)),
              }
            : collection
        )
      );
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No se pudo actualizar la coleccion"
      );
    } finally {
      setBusyCollectionId(null);
    }
  };

  return (
    <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-white">Colecciones</h3>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Guarda este producto dentro de tus listas curadas y compartibles.
          </p>
        </div>
        <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
          {includedCount} activas
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {collections.length > 0 ? (
        <div className="space-y-3">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className="rounded-2xl border border-white/10 bg-black/10 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold text-white">{collection.title}</h4>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-soft)]">
                      {collection.isPublic ? "Publica" : "Privada"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-soft)]">
                    {collection.description || "Coleccion personal para organizar recursos."}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-soft)]">
                    {collection.itemCount} productos
                  </p>
                </div>
                <Button
                  type="button"
                  variant={collection.isIncluded ? "secondary" : "ghost"}
                  disabled={busyCollectionId === collection.id}
                  onClick={() => toggleProduct(collection.id, collection.isIncluded)}
                >
                  {busyCollectionId === collection.id
                    ? "Guardando..."
                    : collection.isIncluded
                      ? "Quitar"
                      : "Anadir"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/10 px-5 py-6 text-center">
          <p className="text-[var(--text-soft)]">
            Aun no tienes colecciones. Crea la primera y este producto quedara guardado de inmediato.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? "Ocultar formulario" : "Nueva coleccion"}
        </Button>
      </div>

      {showCreateForm ? (
        <CollectionForm
          compact
          initialProductId={productId}
          onCreated={(collection) => {
            setCollections((current) => [
              {
                id: collection.id,
                title: collection.title,
                slug: collection.slug,
                description: collection.description,
                isPublic: collection.is_public,
                itemCount: collection.item_count,
                isIncluded: true,
              },
              ...current,
            ]);
            setShowCreateForm(false);
          }}
        />
      ) : null}
    </div>
  );
}
