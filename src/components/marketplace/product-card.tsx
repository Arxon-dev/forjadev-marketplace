"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ShoppingQualitySnapshot } from "@/lib/marketplace/quality-signals";
import { trackMarketplaceEvent } from "@/lib/analytics/marketplace";
import { ShoppingQualitySummary } from "@/components/marketplace/shopping-quality-summary";
import { commercePanelClassName } from "@/components/marketplace/commerce-surface-system";

interface ProductCardProps {
  title: string;
  author: string;
  category: string;
  price: string;
  originalPrice?: string | null;
  promoLabel?: string | null;
  compatibility: string;
  ratingAverage?: number | null;
  ratingCount?: number;
  href?: string;
  imageUrl?: string | null;
  qualitySnapshot?: ShoppingQualitySnapshot | null;
  tracking?: {
    pageType: string;
    entityType?: string;
    entityId: string;
    metadata?: Record<string, unknown> | null;
  };
}

export function ProductCard({
  title,
  author,
  category,
  price,
  originalPrice = null,
  promoLabel = null,
  compatibility,
  ratingAverage = null,
  ratingCount = 0,
  href,
  imageUrl,
  qualitySnapshot = null,
  tracking,
}: ProductCardProps) {
  const hasRating = typeof ratingAverage === "number" && ratingCount > 0;

  const content = (
    <Card
      className={`${commercePanelClassName("tile")} group h-full overflow-hidden p-4 transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_24px_56px_rgba(2,8,23,0.34)]`}
      data-premium-card="product"
    >
      <div className="relative overflow-hidden rounded-[1.45rem] border border-white/10 bg-black/20">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            width={800}
            height={450}
            className="aspect-[16/9] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="aspect-[16/9] bg-[radial-gradient(circle_at_top_left,rgba(91,140,255,0.18),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(11,16,32,0.88))]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_20%,rgba(4,10,20,0.14)_58%,rgba(4,10,20,0.82)_100%)]" />
        <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-3">
          <Badge className="border-white/10 bg-black/35 text-white">Marketplace item</Badge>
          <div className="rounded-full border border-[var(--primary)]/25 bg-slate-950/85 px-3 py-1.5 text-right shadow-[0_14px_24px_rgba(2,8,23,0.24)]">
            <p className="text-sm font-semibold text-white">{price}</p>
            {originalPrice ? (
              <p className="mt-0.5 text-[11px] text-[var(--text-soft)] line-through">{originalPrice}</p>
            ) : null}
          </div>
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
          <Badge className="border-white/10 bg-black/35 text-white">{category}</Badge>
          <Badge className="border-white/10 bg-black/35 text-white">{compatibility}</Badge>
          {promoLabel ? (
            <Badge className="border-emerald-400/25 bg-emerald-400/15 text-emerald-100">
              {promoLabel}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Producto destacado
          </p>
          <h3 className="mt-3 line-clamp-2 text-xl font-semibold leading-7 text-white">{title}</h3>
          <p className="mt-1 truncate text-sm text-[var(--text-soft)]">por {author}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-right">
          {hasRating ? (
            <>
              <p className="text-sm font-semibold text-white">{ratingAverage!.toFixed(1)}/5</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-soft)]">
                {ratingCount} resenas
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">Nuevo</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-soft)]">
                Sin resenas
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Precio</p>
          <p className="mt-2 text-sm font-semibold text-white">{price}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Compatibilidad</p>
          <p className="mt-2 text-sm font-semibold text-white">{compatibility}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Evaluacion</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {hasRating ? "Con prueba social" : "Pendiente de feedback"}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">
        Lectura comercial compacta para comparar valor, soporte y mantenimiento sin salir del browse.
      </p>

      {qualitySnapshot ? (
        <div className="mt-4">
          <ShoppingQualitySummary snapshot={qualitySnapshot} variant="compact" />
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
          Compara antes de comprar
        </p>
        <p className="text-sm font-semibold text-white transition group-hover:translate-x-0.5">
          Abrir ficha completa
        </p>
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block transition-transform hover:-translate-y-1"
        onClick={() => {
          if (!tracking) {
            return;
          }

          trackMarketplaceEvent({
            eventName: "product.card.clicked",
            pageType: tracking.pageType,
            entityType: tracking.entityType ?? "product",
            entityId: tracking.entityId,
            metadata: tracking.metadata ?? null,
          });
        }}
      >
        {content}
      </Link>
    );
  }

  return content;
}
