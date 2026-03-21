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
  const content = (
    <Card
      className={`${commercePanelClassName("tile")} overflow-hidden p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.08]`}
      data-premium-card="product"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={title}
          width={800}
          height={450}
          className="mb-4 aspect-[16/9] w-full rounded-[1.3rem] object-cover"
        />
      ) : (
        <div className="mb-4 aspect-[16/9] rounded-[1.3rem] bg-white/5" />
      )}
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
        Marketplace item
      </p>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-[var(--text-soft)]">por {author}</p>
        </div>
        <div className="text-right">
          <Badge className="border-[var(--primary)]/25 bg-[var(--primary)]/15 text-white">
            {price}
          </Badge>
          {originalPrice ? (
            <p className="mt-2 text-xs text-[var(--text-soft)] line-through">{originalPrice}</p>
          ) : null}
        </div>
      </div>
      {promoLabel ? (
        <div className="mt-3">
          <Badge>{promoLabel}</Badge>
        </div>
      ) : null}
      <div className="mt-4 flex items-center gap-2">
        <Badge>{category}</Badge>
        <Badge>{compatibility}</Badge>
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">
        Vista preparada para comparar valor, mantenimiento y soporte sin salir del browse.
      </p>
      {ratingAverage && ratingCount > 0 ? (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <p className="font-medium text-white">{ratingAverage.toFixed(1)}/5</p>
          <p className="text-[var(--text-soft)]">
            {ratingCount} {ratingCount === 1 ? "resena" : "resenas"}
          </p>
        </div>
      ) : (
        <div className="mt-4 text-sm text-[var(--text-soft)]">Sin valoraciones publicas</div>
      )}
      {qualitySnapshot ? <ShoppingQualitySummary snapshot={qualitySnapshot} variant="compact" /> : null}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
          Compara antes de comprar
        </p>
        <p className="text-sm font-semibold text-white">Abrir ficha completa</p>
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
