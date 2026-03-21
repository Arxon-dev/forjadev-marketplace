"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { commercePanelClassName } from "@/components/marketplace/commerce-surface-system";
import { trackMarketplaceEvent } from "@/lib/analytics/marketplace";

interface ProductFiltersProps {
  initialSearch: string;
  initialPricing: string;
  initialSort: string;
  initialGame: string;
  initialCategory: string;
  games: Array<{
    slug: string;
    name: string;
  }>;
  categories: Array<{
    slug: string;
    name: string;
    parent_id: string | null;
  }>;
}

const pricingOptions = [
  { value: "all", label: "Todos" },
  { value: "free", label: "Gratis" },
  { value: "paid", label: "De pago" },
];

const sortOptions = [
  { value: "newest", label: "Mas recientes" },
  { value: "quality_trust", label: "Calidad y trust" },
  { value: "updated", label: "Recien actualizados" },
  { value: "trending", label: "Tendencia" },
  { value: "best_rated", label: "Mejor valorados" },
  { value: "most_downloaded", label: "Mas descargados" },
  { value: "price_asc", label: "Precio ascendente" },
  { value: "price_desc", label: "Precio descendente" },
  { value: "title", label: "Titulo" },
];

export function ProductFilters({
  initialSearch,
  initialPricing,
  initialSort,
  initialGame,
  initialCategory,
  games,
  categories,
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);

  const pushParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    const trackingMetadata = {
      search: "q" in updates ? updates.q || "" : initialSearch,
      pricing: "pricing" in updates ? updates.pricing || "all" : initialPricing,
      sort: "sort" in updates ? updates.sort || "newest" : initialSort,
      game: "game" in updates ? updates.game || "all" : initialGame,
      category: "category" in updates ? updates.category || "all" : initialCategory,
    };

    if ("q" in updates && (updates.q || "").trim()) {
      trackMarketplaceEvent({
        eventName: "search.executed",
        pageType: "catalog",
        metadata: trackingMetadata,
      });
    }

    if (["pricing", "sort", "game", "category"].some((key) => key in updates)) {
      trackMarketplaceEvent({
        eventName: "filter.applied",
        pageType: "catalog",
        metadata: trackingMetadata,
      });
    }

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    startTransition(() => {
      const next = params.toString();
      router.push(next ? `${pathname}?${next}` : pathname);
    });
  };

  return (
    <div className={`${commercePanelClassName("section")} mt-8 p-5`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Browse controls
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">Refina el catalogo sin perder contexto comercial</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
            Busca por intencion, ajusta el rango de browsing y cambia el ranking para comparar con mas criterio.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_auto]">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                pushParams({ q: search.trim() });
              }
            }}
            className="flex-1 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white placeholder:text-white/30 focus:border-[var(--primary)]/40 focus:outline-none"
            placeholder="Buscar por titulo, descripcion o compatibilidad..."
          />
          <Button type="button" onClick={() => pushParams({ q: search.trim() })} disabled={isPending}>
            Buscar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSearch("");
              startTransition(() => {
                router.push(pathname);
              });
            }}
            disabled={isPending}
          >
            Limpiar
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="mb-3 text-sm font-medium text-white">Juego</p>
          <select
            value={initialGame}
            onChange={(e) => pushParams({ game: e.target.value })}
            className="w-full rounded-2xl border border-white/10 bg-[var(--surface-3)] px-4 py-3 text-white focus:border-[var(--primary)]/40 focus:outline-none"
            disabled={isPending}
          >
            <option value="all">Todos los juegos</option>
            {games.map((game) => (
              <option key={game.slug} value={game.slug}>
                {game.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="mb-3 text-sm font-medium text-white">Categoria</p>
          <select
            value={initialCategory}
            onChange={(e) => pushParams({ category: e.target.value })}
            className="w-full rounded-2xl border border-white/10 bg-[var(--surface-3)] px-4 py-3 text-white focus:border-[var(--primary)]/40 focus:outline-none"
            disabled={isPending}
          >
            <option value="all">Todas las categorias</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.parent_id ? `- ${category.name}` : category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="mb-3 text-sm font-medium text-white">Precio</p>
          <div className="flex flex-wrap gap-3">
            {pricingOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={initialPricing === option.value ? "primary" : "secondary"}
                onClick={() => pushParams({ pricing: option.value })}
                disabled={isPending}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="mb-3 text-sm font-medium text-white">Orden</p>
          <div className="flex flex-wrap gap-3">
            {sortOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={initialSort === option.value ? "primary" : "secondary"}
                onClick={() => pushParams({ sort: option.value })}
                disabled={isPending}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
