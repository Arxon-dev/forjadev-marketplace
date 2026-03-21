import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  CommerceContextBadges,
  CommercePanel,
  commercePanelClassName,
} from "@/components/marketplace/commerce-surface-system";

interface HeroSpotlight {
  eyebrow: string;
  title: string;
  summary: string;
  href: string;
  meta: string;
}

interface HeroProps {
  categoryCount: number;
  activeDealCount: number;
  bundleCount: number;
  placementCount: number;
  featuredCategory?: {
    name: string;
    slug: string;
  } | null;
}

export function Hero({
  categoryCount,
  activeDealCount,
  bundleCount,
  placementCount,
  featuredCategory = null,
}: HeroProps) {
  const spotlightCards: HeroSpotlight[] = [
    {
      eyebrow: "Deals activos",
      title: "Encuentra oportunidades de compra listas para convertir.",
      summary:
        "Las promociones visibles dejan de estar enterradas y pasan a ser una ruta real de discovery premium.",
      href: "/deals",
      meta: `${activeDealCount} deals visibles ahora`,
    },
    {
      eyebrow: "Bundles premium",
      title: "Compra valor agrupado con continuidad clara hacia checkout.",
      summary:
        "Packs activos con framing comercial propio para comparar ahorro, contenido incluido y contexto postcompra.",
      href: "/bundles",
      meta: `${bundleCount} bundles activos`,
    },
    {
      eyebrow: featuredCategory ? "Entrada por categoria" : "Browse guiado",
      title: featuredCategory
        ? `Empieza por ${featuredCategory.name} si ya vienes con una intencion clara.`
        : "Entra al catalogo desde categorias y juegos para reducir friccion.",
      summary:
        "La home ya no solo presenta el marketplace: te orienta hacia el siguiente browse comercial correcto.",
      href: featuredCategory ? `/categories/${featuredCategory.slug}` : "/categories",
      meta: `${categoryCount} rutas de categoria activas`,
    },
  ];

  return (
    <section className="container-shell py-10 md:py-12 xl:py-14">
      <section
        className={`${commercePanelClassName("stage")} overflow-hidden p-6 md:p-8 xl:p-10`}
        data-commerce-stage="home-hero"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_24%,rgba(11,16,32,0.24))]" />
        <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-3">
              <p className="inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
                <span className="h-px w-8 bg-[var(--primary)]/70" />
                Marketplace editorial premium
              </p>
              <Badge className="border-white/10 bg-black/20 text-white">
                Discovery con intencion de compra
              </Badge>
            </div>

            <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight text-white md:text-5xl xl:text-6xl">
              Descubre recursos premium para servidores con una apertura comercial mas clara, mas rica y mas confiable.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--text-soft)] md:text-lg">
              ForjaDev convierte la entrada del marketplace en una capa editorial de compra: browse
              guiado, deals visibles, bundles con valor real y rutas de categoria preparadas para
              decidir rapido sin perder contexto.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex min-h-11 items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--teal))] px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_18px_38px_rgba(31,214,200,0.22)] transition hover:translate-y-[-1px] hover:opacity-95"
              >
                Explorar catalogo
              </Link>
              <Link
                href="/deals"
                className="inline-flex min-h-11 items-center rounded-full border border-[var(--border-strong)] bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(2,8,23,0.16)] transition hover:border-white/30 hover:bg-white/[0.1]"
              >
                Ver deals activos
              </Link>
              <Link
                href="/bundles"
                className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-black/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                Comparar bundles
              </Link>
            </div>

            <div className="mt-8">
              <CommerceContextBadges
                items={[
                  "Cards decisionales ya elevadas",
                  "Browse shell compartido",
                  "Header comercial reforzado",
                ]}
              />
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <CommercePanel variant="soft" className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                  Value proposition
                </p>
                <p className="mt-3 text-base font-semibold text-white">
                  Compra con contexto, no desde una home decorativa.
                </p>
              </CommercePanel>
              <CommercePanel variant="soft" className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                  Supporting benefits
                </p>
                <p className="mt-3 text-base font-semibold text-white">
                  Deals, bundles y categorias entran en la narrativa principal.
                </p>
              </CommercePanel>
              <CommercePanel variant="soft" className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
                  Trust framing
                </p>
                <p className="mt-3 text-base font-semibold text-white">
                  Discovery premium con continuidad real hacia comparacion y compra.
                </p>
              </CommercePanel>
            </div>
          </div>

          <div className="grid gap-4">
            <CommercePanel variant="section" className="p-5" dataId="home-editorial-brief">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                    Brief comercial
                  </p>
                  <h2 className="mt-3 text-2xl font-bold text-white">
                    La home ya abre el marketplace con direccion comercial concreta.
                  </h2>
                </div>
                <Badge className="border-white/10 bg-black/20 text-white">
                  {placementCount} placements premium
                </Badge>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.4rem] border border-white/10 bg-black/15 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    Discovery
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">Catalogo navegable desde varias entradas.</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-black/15 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    Conversion
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">Deals y bundles ganan protagonismo desde el primer scroll.</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-black/15 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    Taxonomia
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">{categoryCount} rutas de categoria listas para browse guiado.</p>
                </div>
                <div className="rounded-[1.4rem] border border-white/10 bg-black/15 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    Merchandising
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">{activeDealCount} deals activos y {bundleCount} bundles visibles.</p>
                </div>
              </div>
            </CommercePanel>

            <div className="grid gap-4">
              {spotlightCards.map((card) => (
                <Link key={card.title} href={card.href} className="block transition-transform hover:-translate-y-1">
                  <CommercePanel variant="soft" className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                          {card.eyebrow}
                        </p>
                        <h3 className="mt-3 text-xl font-semibold text-white">{card.title}</h3>
                      </div>
                      <Badge className="border-white/10 bg-black/20 text-white">{card.meta}</Badge>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">{card.summary}</p>
                    <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                        Continuidad editorial
                      </p>
                      <p className="text-sm font-semibold text-white">Abrir superficie</p>
                    </div>
                  </CommercePanel>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
