import Link from "next/link";
import type { ProductCompositionBundle } from "@/lib/commerce/product-composition";
import { CommerceSectionHeading } from "@/components/marketplace/commerce-surface-system";
import { Badge } from "@/components/ui/badge";

interface ProductCompositionPanelProps {
  productTitle: string;
  basePriceCents: number;
  bundles: ProductCompositionBundle[];
}

export function ProductCompositionPanel({
  productTitle,
  basePriceCents,
  bundles,
}: ProductCompositionPanelProps) {
  if (bundles.length === 0) {
    return null;
  }

  return (
    <section
      data-commercial-composition="product-bundles"
      className="mt-12 rounded-3xl border border-white/10 bg-white/5 p-6"
    >
      <CommerceSectionHeading
        eyebrow="Compra compuesta"
        title="Este producto tambien se vende mejor como parte de un bundle"
        description="Compara la compra individual con packs activos que ya incluyen este producto y aportan ahorro o valor combinado antes del checkout."
      />

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-[var(--text-soft)]">
        <p>
          Compra individual actual:{" "}
          <span className="font-semibold text-white">EUR {(basePriceCents / 100).toFixed(2)}</span>
        </p>
        <p className="mt-2">
          Si tu objetivo es salir con mas valor del marketplace que con una sola ficha, estos bundles ya te dan una ruta compuesta lista para comparar.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {bundles.map((bundle) => (
          <article key={bundle.id} className="rounded-2xl border border-white/10 bg-black/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{bundle.title}</h3>
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  {bundle.shortDescription || "Bundle activo con valor compuesto y continuidad a compra."}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white">
                  EUR {(bundle.checkoutPriceCents / 100).toFixed(2)}
                </p>
                {bundle.checkoutPriceCents < bundle.originalTotalCents ? (
                  <p className="mt-1 text-xs text-[var(--text-soft)] line-through">
                    EUR {(bundle.originalTotalCents / 100).toFixed(2)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{bundle.itemCount} productos</Badge>
              <Badge>Ahorro EUR {(bundle.savingsCents / 100).toFixed(2)}</Badge>
              {bundle.promoLabel ? <Badge>{bundle.promoLabel}</Badge> : null}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                Incluye
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {bundle.includedProducts.slice(0, 4).map((product) => (
                  <Badge
                    key={`${bundle.id}:${product.id}`}
                    className={
                      product.title === productTitle
                        ? "border-[var(--primary)]/30 bg-[var(--primary)]/15 text-white"
                        : "border-white/10 bg-white/5 text-white"
                    }
                  >
                    {product.title}
                  </Badge>
                ))}
              </div>
            </div>

            <p className="mt-4 text-sm text-[var(--text-soft)]">{bundle.sellerContext}</p>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                Valor combinado claro
              </p>
              <Link href={`/bundles/${bundle.slug}`} className="text-sm font-semibold text-white hover:underline">
                Ver bundle
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
