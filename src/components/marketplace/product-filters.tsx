"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

interface ProductFiltersProps {
  initialSearch: string;
  initialPricing: string;
  initialSort: string;
}

const pricingOptions = [
  { value: "all", label: "Todos" },
  { value: "free", label: "Gratis" },
  { value: "paid", label: "De pago" },
];

const sortOptions = [
  { value: "newest", label: "Mas recientes" },
  { value: "price_asc", label: "Precio ascendente" },
  { value: "price_desc", label: "Precio descendente" },
  { value: "title", label: "Titulo" },
];

export function ProductFilters({
  initialSearch,
  initialPricing,
  initialSort,
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);

  const pushParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

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
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_auto]">
        <div className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                pushParams({ q: search.trim() });
              }
            }}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="Buscar por titulo..."
          />
          <Button
            type="button"
            onClick={() => pushParams({ q: search.trim() })}
            disabled={isPending}
          >
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
        <div>
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

        <div>
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
