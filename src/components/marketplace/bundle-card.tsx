import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { commercePanelClassName } from "@/components/marketplace/commerce-surface-system";

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
        className={`${commercePanelClassName("tile")} group h-full overflow-hidden p-4 transition duration-200 hover:border-white/20 hover:shadow-[0_24px_56px_rgba(2,8,23,0.34)]`}
        data-premium-card="bundle"
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
            <div className="aspect-[16/9] bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(11,16,32,0.88))]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_18%,rgba(4,10,20,0.18)_58%,rgba(4,10,20,0.82)_100%)]" />
          <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-3">
            <Badge className="border-white/10 bg-black/35 text-white">Bundle comercial</Badge>
            <div className="rounded-full border border-[var(--primary)]/25 bg-slate-950/85 px-3 py-1.5 text-right shadow-[0_14px_24px_rgba(2,8,23,0.24)]">
              <p className="text-sm font-semibold text-white">{price}</p>
              {originalPrice ? (
                <p className="mt-0.5 text-[11px] text-[var(--text-soft)] line-through">{originalPrice}</p>
              ) : null}
            </div>
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
            <Badge className="border-white/10 bg-black/35 text-white">{itemCount} productos</Badge>
            <Badge className="border-emerald-400/25 bg-emerald-400/15 text-emerald-100">
              {savingsLabel}
            </Badge>
            {promoLabel ? (
              <Badge className="border-white/10 bg-black/35 text-white">{promoLabel}</Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              Pack decisional
            </p>
            <h3 className="mt-3 line-clamp-2 text-xl font-semibold leading-7 text-white">{title}</h3>
            <p className="mt-1 truncate text-sm text-[var(--text-soft)]">por {author}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-2 text-right">
            <p className="text-sm font-semibold text-white">{itemCount} items</p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-soft)]">Valor agrupado</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Ahorro</p>
            <p className="mt-2 text-sm font-semibold text-white">{savingsLabel}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Formato</p>
            <p className="mt-2 text-sm font-semibold text-white">Checkout unico</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Continuidad</p>
            <p className="mt-2 text-sm font-semibold text-white">Licencias por producto</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">
          {shortDescription || "Pack comercial listo para comparar ahorro, contenido incluido y continuidad a compra."}
        </p>

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
            Valor agrupado visible
          </p>
          <p className="text-sm font-semibold text-white transition group-hover:translate-x-0.5">
            Abrir bundle completo
          </p>
        </div>
      </Card>
    </Link>
  );
}
