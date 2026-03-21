import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface BundleCardProps {
  title: string;
  author: string;
  price: string;
  originalPrice?: string | null;
  promoLabel?: string | null;
  itemCount: number;
  savingsLabel: string;
  href: string;
  imageUrl?: string | null;
  shortDescription?: string | null;
  productPreview?: string[];
  trustHighlights?: string[];
}

export function BundleCard({
  title,
  author,
  price,
  originalPrice = null,
  promoLabel = null,
  itemCount,
  savingsLabel,
  href,
  imageUrl = null,
  shortDescription = null,
  productPreview = [],
  trustHighlights = [],
}: BundleCardProps) {
  return (
    <Link href={href} className="block transition-transform hover:-translate-y-1">
      <Card
        className="overflow-hidden rounded-[1.9rem] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.065),rgba(255,255,255,0.03))] p-4 shadow-[0_18px_50px_rgba(2,8,23,0.24)] hover:bg-white/[0.07]"
        data-premium-card="bundle"
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
          Bundle comercial
        </p>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
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

        {shortDescription ? (
          <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">{shortDescription}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{itemCount} productos</Badge>
          <Badge>{savingsLabel}</Badge>
          {promoLabel ? <Badge>{promoLabel}</Badge> : null}
        </div>

        {productPreview.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Incluye
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {productPreview.map((product) => (
                <Badge key={`${title}:${product}`} className="border-white/10 bg-white/5 text-white">
                  {product}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {trustHighlights.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Compra con contexto
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--text-soft)]">
              {trustHighlights.map((highlight) => (
                <li key={`${title}:${highlight}`}>{highlight}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
            Listo para comparar
          </p>
          <p className="text-sm font-semibold text-white">Ver bundle</p>
        </div>
      </Card>
    </Link>
  );
}
