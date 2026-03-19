import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { SellerFollowButton } from "@/components/community/seller-follow-button";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { ProductCard } from "@/components/marketplace/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";
import { getPublicSellerProfile } from "@/lib/sellers/public";

interface SellerProfilePageProps {
  params: Promise<{
    slug: string;
  }>;
}

function badgeToneClass(tone: "primary" | "success" | "warning") {
  if (tone === "success") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (tone === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-sky-500/30 bg-sky-500/10 text-sky-100";
}

export default async function SellerProfilePage({ params }: SellerProfilePageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const seller = await getPublicSellerProfile(supabase, adminSupabase, slug);

  if (!seller) {
    notFound();
  }

  const categoryIds = Array.from(
    new Set(seller.products.map((product) => product.category_id).filter(Boolean))
  );
  const gameIds = Array.from(
    new Set(seller.products.map((product) => product.game_id).filter(Boolean))
  );

  const [categoriesResult, gamesResult] = await Promise.all([
    categoryIds.length > 0
      ? supabase.from("categories").select("id, name, slug").in("id", categoryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; slug: string }> }),
    gameIds.length > 0
      ? supabase.from("games").select("id, name, slug").in("id", gameIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; slug: string }> }),
  ]);

  const categoryById = new Map((categoriesResult.data || []).map((item) => [item.id, item]));
  const gameById = new Map((gamesResult.data || []).map((item) => [item.id, item]));

  const topCategories = Array.from(
    seller.products.reduce((map, product) => {
      if (!product.category_id) {
        return map;
      }

      map.set(product.category_id, (map.get(product.category_id) || 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([categoryId, count]) => ({
      ...categoryById.get(categoryId),
      count,
    }))
    .filter((item): item is { id: string; name: string; slug: string; count: number } => Boolean(item));

  const topGames = Array.from(
    seller.products.reduce((map, product) => {
      if (!product.game_id) {
        return map;
      }

      map.set(product.game_id, (map.get(product.game_id) || 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([gameId, count]) => ({
      ...gameById.get(gameId),
      count,
    }))
    .filter((item): item is { id: string; name: string; slug: string; count: number } => Boolean(item));

  const [{ count: followerCount }, followEntryResult] = await Promise.all([
    adminSupabase
      .from("seller_followers")
      .select("*", { count: "exact", head: true })
      .eq("vendor_id", seller.vendor.id),
    user
      ? supabase
          .from("seller_followers")
          .select("id")
          .eq("user_id", user.id)
          .eq("vendor_id", seller.vendor.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const isFollowing = Boolean(followEntryResult.data);
  const isOwnSeller = Boolean(user && seller.vendor.user_id === user.id);

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker
        eventName="seller.profile.opened"
        pageType="seller_profile"
        entityType="seller"
        entityId={seller.vendor.id}
        metadata={{
          slug: seller.vendor.slug,
          approvedProducts: seller.metrics.approvedProducts,
        }}
      />
      <section className="container-shell py-16">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
          <Link href="/products" className="hover:text-white">
            Productos
          </Link>
          <span>/</span>
          <span className="text-white">{seller.vendor.store_name}</span>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
              Seller profile
            </p>
            <h1 className="mt-3 text-4xl font-bold text-white">{seller.vendor.store_name}</h1>
            <p className="mt-4 max-w-3xl text-lg text-[var(--text-soft)]">
              {seller.vendor.bio ||
                "Este creador publica recursos para servidores en ForjaDev y mantiene un catalogo activo para la comunidad."}
            </p>

            {seller.vendor.discord_url ||
            seller.vendor.steam_url ||
            seller.vendor.x_url ||
            seller.vendor.website_url ? (
              <div className="mt-5 flex flex-wrap gap-3">
                {seller.vendor.discord_url ? (
                  <a
                    href={seller.vendor.discord_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Discord
                  </a>
                ) : null}
                {seller.vendor.steam_url ? (
                  <a
                    href={seller.vendor.steam_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Steam
                  </a>
                ) : null}
                {seller.vendor.x_url ? (
                  <a
                    href={seller.vendor.x_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    X
                  </a>
                ) : null}
                {seller.vendor.website_url ? (
                  <a
                    href={seller.vendor.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Web
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              {seller.badges.map((badge) => (
                <Badge key={badge.label} className={cn("text-sm", badgeToneClass(badge.tone))}>
                  {badge.label}
                </Badge>
              ))}
            </div>

            {seller.identityVerification.isVerified ? (
              <p className="mt-4 text-sm text-[var(--text-soft)]">
                Identidad comunitaria verificada en{" "}
                <span className="font-semibold text-white">
                  {seller.identityVerification.providers
                    .map((provider) => provider.charAt(0).toUpperCase() + provider.slice(1))
                    .join(" y ")}
                </span>
                .
              </p>
            ) : null}

            {!isOwnSeller ? (
              <div className="mt-6">
                <SellerFollowButton
                  vendorId={seller.vendor.id}
                  initialFollowing={isFollowing}
                  initialFollowerCount={followerCount || 0}
                  pageType="seller_profile"
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
              Trust snapshot
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-[var(--text-soft)]">Productos aprobados</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {seller.metrics.approvedProducts}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-[var(--text-soft)]">Valoracion media</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {seller.metrics.averageRating ? `${seller.metrics.averageRating}/5` : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-[var(--text-soft)]">Compras totales</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {seller.metrics.totalPurchases}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-[var(--text-soft)]">Descargas totales</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {seller.metrics.totalDownloads}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4 sm:col-span-2">
                <p className="text-sm text-[var(--text-soft)]">Trust score</p>
                <div className="mt-3 flex items-center gap-4">
                  <p className="text-3xl font-bold text-white">{seller.metrics.reputationScore}</p>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--primary)]"
                      style={{ width: `${Math.min(100, seller.metrics.reputationScore)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2 text-sm text-[var(--text-soft)]">
              <p>
                Desde:{" "}
                <span className="text-white">
                  {new Date(seller.metrics.joinedAt).toLocaleDateString("es-ES")}
                </span>
              </p>
              <p>
                Ultima actualizacion:{" "}
                <span className="text-white">
                  {seller.metrics.latestProductUpdateAt
                    ? new Date(seller.metrics.latestProductUpdateAt).toLocaleDateString("es-ES")
                    : "Sin publicaciones recientes"}
                </span>
              </p>
              <p>
                Portfolio:{" "}
                <span className="text-white">
                  {seller.metrics.paidProducts} de pago / {seller.metrics.freeProducts} gratis
                </span>
              </p>
              <p>
                Seguidores: <span className="text-white">{followerCount || 0}</span>
              </p>
              <p>
                Verificacion:{" "}
                <span className="text-white">
                  {seller.identityVerification.isVerified
                    ? seller.identityVerification.providers
                        .map((provider) =>
                          provider.charAt(0).toUpperCase() + provider.slice(1)
                        )
                        .join(" / ")
                    : "Sin verificar"}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Especialidades</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {topCategories.length > 0 ? (
                topCategories.map((category) => (
                  <Link key={category.id} href={`/categories/${category.slug}`}>
                    <Badge className="text-sm hover:border-white/20 hover:text-white">
                      {category.name} · {category.count}
                    </Badge>
                  </Link>
                ))
              ) : (
                <p className="text-[var(--text-soft)]">Aun no hay categorias visibles.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Juegos activos</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {topGames.length > 0 ? (
                topGames.map((game) => (
                  <Link key={game.id} href={`/games/${game.slug}`}>
                    <Badge className="text-sm hover:border-white/20 hover:text-white">
                      {game.name} · {game.count}
                    </Badge>
                  </Link>
                ))
              ) : (
                <p className="text-[var(--text-soft)]">Sin asignacion de juegos todavia.</p>
              )}
            </div>
          </div>
        </div>

        <section className="mt-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">Catalogo del creador</h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Recursos publicados y aprobados que ya aportan valor real al marketplace.
              </p>
            </div>
            <Link href="/products">
              <Button variant="secondary">Explorar marketplace</Button>
            </Link>
          </div>

          {seller.products.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {seller.products.map((product) => (
                <ProductCard
                  key={product.id}
                  title={product.title}
                  author={seller.vendor.store_name}
                  category={categoryById.get(product.category_id || "")?.name || "Marketplace"}
                  price={product.is_free ? "Gratis" : `EUR ${(product.price_cents / 100).toFixed(2)}`}
                  compatibility={
                    product.compatibility || gameById.get(product.game_id || "")?.name || "Rust"
                  }
                  ratingAverage={product.rating_average}
                  ratingCount={product.rating_count}
                  href={`/products/${product.slug}`}
                  imageUrl={product.featured_image_url}
                  tracking={{
                    pageType: "seller_profile",
                    entityId: product.id,
                    metadata: {
                      source: "seller_profile",
                      sellerSlug: seller.vendor.slug,
                    },
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center">
              <p className="text-[var(--text-soft)]">
                Este seller todavia no tiene productos aprobados visibles.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
