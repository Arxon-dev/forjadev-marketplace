"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { trackMarketplaceEvent } from "@/lib/analytics/marketplace";

interface ProductCardProps {
  title: string;
  author: string;
  category: string;
  price: string;
  compatibility: string;
  ratingAverage?: number | null;
  ratingCount?: number;
  href?: string;
  imageUrl?: string | null;
  tracking?: {
    pageType: string;
    entityId: string;
    metadata?: Record<string, unknown> | null;
  };
}

export function ProductCard({
  title,
  author,
  category,
  price,
  compatibility,
  ratingAverage = null,
  ratingCount = 0,
  href,
  imageUrl,
  tracking,
}: ProductCardProps) {
  const content = (
    <Card className="overflow-hidden p-4 hover:bg-white/[0.07]">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={title}
          width={800}
          height={450}
          className="mb-4 aspect-[16/9] w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mb-4 aspect-[16/9] rounded-xl bg-white/5" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-[var(--text-soft)]">por {author}</p>
        </div>
        <Badge>{price}</Badge>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Badge>{category}</Badge>
        <Badge>{compatibility}</Badge>
      </div>
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
            entityType: "product",
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
