import Link from "next/link";
import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { ProductCard } from "@/components/marketplace/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserActivityFeed } from "@/lib/community/activity-feed";
import { getUserEngagementLoopSnapshot } from "@/lib/community/engagement-loop";
import { getRecommendedBundles, getPersonalizedRecommendations } from "@/lib/intelligence/recommendations";
import { getPublicDealsForBundles } from "@/lib/promotions/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function accentClass(accent: string) {
  if (accent === "Seguimiento") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-100";
  }

  if (accent === "Discusion") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }

  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
}

export default async function ActivityFeedPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main>
        <SiteHeaderServer />
        <section className="container-shell py-16">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-16 text-center">
            <h1 className="text-3xl font-bold text-white">Necesitas iniciar sesion</h1>
            <p className="mt-4 text-[var(--text-soft)]">
              El feed de actividad se construye con tus sellers seguidos, wishlist y colecciones relacionadas.
            </p>
            <Link href="/login" className="mt-6 inline-flex">
              <Button>Iniciar sesion</Button>
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const items = await getUserActivityFeed(supabase, adminSupabase, user.id);
  const [personalizedProducts, recommendedBundles, engagementSnapshot] = await Promise.all([
    getPersonalizedRecommendations(user.id, 3),
    getRecommendedBundles(user.id, 3),
    getUserEngagementLoopSnapshot(supabase, adminSupabase, user.id),
  ]);
  const bundleDeals = await getPublicDealsForBundles(
    recommendedBundles.map((bundle) => ({
      id: bundle.id,
      price_cents: bundle.price_cents,
    }))
  );

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker
        eventName="activity.feed.visited"
        pageType="activity_feed"
        metadata={{
          activityCount: items.length,
          personalizedProducts: personalizedProducts.length,
          recommendedBundles: recommendedBundles.length,
          relevantCollections: engagementSnapshot.relevantCollections.length,
        }}
      />
      <section className="container-shell py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
              Community layer
            </p>
            <h1 className="mt-3 text-4xl font-bold text-white">Actividad relevante</h1>
            <p className="mt-4 max-w-3xl text-lg text-[var(--text-soft)]">
              Un feed personal construido a partir de lo que sigues y guardas, para que la comunidad te devuelva señales utiles y no ruido.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard">
              <Button variant="secondary">Volver al dashboard</Button>
            </Link>
            <Link href="/collections">
              <Button>Explorar colecciones</Button>
            </Link>
          </div>
        </div>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] p-6 shadow-[0_18px_50px_rgba(2,8,23,0.18)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
                Engagement loop
              </p>
              <h2 className="mt-3 text-3xl font-bold text-white">Tu senal de retorno</h2>
              <p className="mt-3 max-w-3xl text-[var(--text-soft)]">
                Wishlist, sellers seguidos y colecciones dejan de ser elementos aislados: aqui se convierten en discovery recurrente con contexto comercial real.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{engagementSnapshot.wishlistCount} guardados</Badge>
              <Badge>{engagementSnapshot.followedSellerCount} sellers seguidos</Badge>
              <Badge>{engagementSnapshot.ownedCollectionCount} colecciones tuyas</Badge>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Guardar</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
                Tu wishlist alimenta recomendaciones, activa colecciones relacionadas y da una razon clara para volver.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Seguir</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
                Los sellers que sigues convierten cambios y lanzamientos en actividad util dentro del feed.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Curar</p>
              <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
                Las colecciones te ayudan a guardar intencion de compra y a descubrir combinaciones que luego vuelven como senal relevante.
              </p>
            </div>
          </div>
        </section>

        {engagementSnapshot.relevantCollections.length > 0 ? (
          <section className="mt-10">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Colecciones para retomar</h2>
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  Curaciones publicas que coinciden con productos que ya guardaste y convierten interes previo en nueva exploracion con contexto.
                </p>
              </div>
              <Link href="/collections" className="text-sm text-white hover:underline">
                Ver mas colecciones
              </Link>
            </div>

            <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {engagementSnapshot.relevantCollections.map((collection) => (
                <article
                  key={collection.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6"
                  data-engagement-loop="relevant-collection"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-[var(--text-soft)]">
                        Match con tu wishlist
                      </p>
                      <h3 className="mt-3 text-2xl font-semibold text-white">{collection.title}</h3>
                    </div>
                    <Link
                      href={`/collections/${collection.slug}`}
                      className="text-sm font-semibold text-white hover:underline"
                    >
                      Abrir
                    </Link>
                  </div>

                  <p className="mt-4 text-sm text-[var(--text-soft)]">
                    {collection.description || "Coleccion publica relevante para volver a explorar el marketplace."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Badge>{collection.matchingWishlistCount} match en wishlist</Badge>
                    <Badge>Por {collection.ownerName}</Badge>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {collection.previewProducts.map((product) => (
                      <Link
                        key={product.id}
                        href={`/products/${product.slug}`}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--text-soft)] transition hover:border-white/20 hover:text-white"
                      >
                        {product.title}
                      </Link>
                    ))}
                  </div>

                  <p className="mt-5 text-xs text-[var(--text-soft)]">
                    Actualizada {new Date(collection.updatedAt).toLocaleDateString("es-ES")}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 px-6 py-10">
            <h2 className="text-2xl font-semibold text-white">Activa el loop de retorno</h2>
            <p className="mt-3 max-w-3xl text-[var(--text-soft)]">
              Cuando guardes productos o sigas sellers, este feed empezara a devolverte colecciones y actividad realmente conectadas con tu interes.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/products">
                <Button variant="secondary">Guardar productos</Button>
              </Link>
              <Link href="/collections">
                <Button>Explorar colecciones</Button>
              </Link>
            </div>
          </section>
        )}

        {personalizedProducts.length > 0 ? (
          <section className="mt-10">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Descubrimiento para ti</h2>
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  El feed ya no solo mira actividad social: tambien te devuelve productos alineados con tu comportamiento reciente.
                </p>
              </div>
              <Link href="/products?sort=quality_trust" className="text-sm text-white hover:underline">
                Ver mas recomendaciones
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {personalizedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  title={product.title}
                  author={product.author}
                  category={product.categoryName}
                  price={product.is_free ? "Gratis" : `EUR ${(product.price_cents / 100).toFixed(2)}`}
                  promoLabel={product.recommendationReason}
                  compatibility={product.compatibility || "Rust"}
                  ratingAverage={product.rating_average}
                  ratingCount={product.rating_count}
                  href={`/products/${product.slug}`}
                  imageUrl={product.featured_image_url}
                  tracking={{
                    pageType: "activity_feed",
                    entityId: product.id,
                    metadata: {
                      source: "feed_personalized_products",
                      reason: product.recommendationReason,
                    },
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}

        {recommendedBundles.length > 0 ? (
          <section className="mt-10">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Bundles recomendados</h2>
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  Una capa comercial mas compacta para descubrir packs alineados con tu wishlist, tus compras y los sellers que ya sigues.
                </p>
              </div>
              <Link href="/products" className="text-sm text-white hover:underline">
                Seguir explorando
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {recommendedBundles.map((bundle) => {
                const deal = bundleDeals.get(bundle.id);

                return (
                  <ProductCard
                    key={bundle.id}
                    title={bundle.title}
                    author={bundle.author}
                    category="Bundle premium"
                    price={`EUR ${((deal?.discountedPriceCents ?? bundle.price_cents) / 100).toFixed(2)}`}
                    originalPrice={
                      deal && deal.discountedPriceCents < bundle.price_cents
                        ? `EUR ${(bundle.price_cents / 100).toFixed(2)}`
                        : null
                    }
                    promoLabel={deal?.promoLabel || bundle.recommendationReason}
                    compatibility={`${bundle.includedProductCount} productos`}
                    href={`/bundles/${bundle.slug}`}
                    imageUrl={bundle.featured_image_url}
                    tracking={{
                      pageType: "activity_feed",
                      entityType: "bundle",
                      entityId: bundle.id,
                      metadata: {
                        source: "feed_recommended_bundles",
                        reason: bundle.recommendationReason,
                        includedProductCount: bundle.includedProductCount,
                        hasDeal: Boolean(deal),
                      },
                    }}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {items.length > 0 ? (
          <div className="mt-10 space-y-4">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Badge className={accentClass(item.accent)}>{item.accent}</Badge>
                    <h2 className="mt-4 text-2xl font-semibold text-white">{item.title}</h2>
                    <p className="mt-3 max-w-3xl text-[var(--text-soft)]">{item.description}</p>
                    <p className="mt-4 text-xs text-[var(--text-soft)]">
                      {new Date(item.occurredAt).toLocaleString("es-ES")}
                    </p>
                  </div>
                  <Link href={item.href}>
                    <Button variant="secondary">Abrir</Button>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold text-white">Tu feed todavia esta vacio</h2>
            <p className="mt-4 text-[var(--text-soft)]">
              Sigue sellers, guarda productos en wishlist y participa en colecciones para que la actividad empiece a devolverte descubrimiento con contexto.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/products">
                <Button variant="secondary">Ir al catalogo</Button>
              </Link>
              <Link href="/collections">
                <Button>Ver colecciones publicas</Button>
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
