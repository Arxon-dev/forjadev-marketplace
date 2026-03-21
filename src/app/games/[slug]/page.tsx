import type { Metadata } from "next";
import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { DiscoveryNavSpine } from "@/components/discovery/discovery-nav-spine";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import {
  CommerceSectionHeading,
  CommerceStage,
  commercePanelClassName,
} from "@/components/marketplace/commerce-surface-system";
import { ProductCard } from "@/components/marketplace/product-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createOptionalAdminClient } from "@/lib/supabase/admin";
import { buildShoppingQualitySnapshot } from "@/lib/marketplace/quality-signals";
import { buildPublicMetadata } from "@/lib/seo/public-metadata";
import { createClient } from "@/lib/supabase/server";

interface GamePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: GamePageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: game } = await supabase
    .from("games")
    .select("name, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!game) {
    return buildPublicMetadata({
      title: "Juego no disponible",
      description: "El juego solicitado no esta disponible en el catalogo publico.",
      path: `/games/${slug}`,
      index: false,
    });
  }

  return buildPublicMetadata({
    title: `Recursos de ${game.name}`,
    description: `Explora plugins, mapas y herramientas publicados para ${game.name} dentro de ForjaDev Marketplace.`,
    path: `/games/${game.slug}`,
  });
}

export default async function GamePage({ params }: GamePageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const adminSupabase = createOptionalAdminClient();

  const { data: game } = await supabase
    .from("games")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!game) {
    notFound();
  }

  const [{ data: products }, { data: games }, { data: rootCategories }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, vendor_id, category_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count, updated_at, support_policy, refund_policy, update_policy"
      )
      .eq("moderation_status", "approved")
      .eq("game_id", game.id)
      .order("featured", { ascending: false })
      .order("purchase_count", { ascending: false })
      .order("download_count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("games")
      .select("id, name, slug, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("categories")
      .select("id, name, slug, sort_order")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const vendorIds = Array.from(new Set((products || []).map((product) => product.vendor_id)));
  const categoryIds = Array.from(
    new Set((products || []).map((product) => product.category_id).filter(Boolean))
  );

  const [vendorsResult, categoriesResult] = await Promise.all([
    vendorIds.length > 0
      ? supabase.from("vendors").select("id, user_id, store_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; user_id: string; store_name: string }> }),
    categoryIds.length > 0
      ? supabase.from("categories").select("id, name, slug").in("id", categoryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; slug: string }> }),
  ]);
  const vendorRows = vendorsResult.data || [];
  const vendorUserIds = Array.from(new Set(vendorRows.map((vendor) => vendor.user_id).filter(Boolean)));
  const [sellerSnapshotsResult, identitiesResult] = await Promise.all([
    adminSupabase && vendorIds.length > 0
      ? adminSupabase
          .from("seller_reputation_snapshots")
          .select("vendor_id, approved_products, total_purchases, latest_product_update_at")
          .in("vendor_id", vendorIds)
      : Promise.resolve({
          data: [] as Array<{
            vendor_id: string;
            approved_products: number;
            total_purchases: number;
            latest_product_update_at: string | null;
          }>,
        }),
    adminSupabase && vendorUserIds.length > 0
      ? adminSupabase.from("user_provider_identities").select("user_id").in("user_id", vendorUserIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string }> }),
  ]);

  const vendorById = new Map(
    vendorRows.map((vendor) => [vendor.id, vendor.store_name])
  );
  const vendorUserIdByVendorId = new Map(vendorRows.map((vendor) => [vendor.id, vendor.user_id]));
  const snapshotByVendorId = new Map(
    (sellerSnapshotsResult.data || []).map((snapshot) => [snapshot.vendor_id, snapshot])
  );
  const verifiedUserIds = new Set((identitiesResult.data || []).map((identity) => identity.user_id));
  const categoryById = new Map(
    (categoriesResult.data || []).map((category) => [category.id, category.name])
  );

  const categoryCounts = new Map<string, { name: string; slug: string; count: number }>();
  (products || []).forEach((product) => {
    const matchingCategory = (categoriesResult.data || []).find(
      (item) => item.id === product.category_id
    );

    if (!matchingCategory) {
      return;
    }

    const existing = categoryCounts.get(matchingCategory.id);
    if (existing) {
      existing.count += 1;
      return;
    }

    categoryCounts.set(matchingCategory.id, {
      name: matchingCategory.name,
      slug: matchingCategory.slug,
      count: 1,
    });
  });

  const topCategories = Array.from(categoryCounts.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 4);
  const primaryLinks = [
    { label: "Catalogo completo", href: "/products" },
    { label: "Categorias", href: "/categories" },
    { label: "Juegos", href: "/games" },
  ];
  const categoryLinks = (rootCategories || []).slice(0, 6).map((item) => ({
    label: item.name,
    href: `/categories/${item.slug}`,
  }));
  const gameLinks = (games || []).slice(0, 6).map((item) => ({
    label: item.name,
    href: `/games/${item.slug}`,
    active: item.slug === game.slug,
  }));

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker
        eventName="game.visited"
        pageType="game"
        entityType="game"
        entityId={game.id}
        metadata={{
          slug: game.slug,
          productCount: products?.length || 0,
        }}
      />
      <section className="container-shell py-16">
        <DiscoveryNavSpine
          eyebrow="Marketplace Browse"
          title={`Explora el catalogo de ${game.name}`}
          description="Entra al marketplace por juego, reduce el espacio de busqueda y sigue bajando por categorias sin salir de una navegacion comercial consistente."
          path={[
            { label: "Productos", href: "/products" },
            { label: "Juegos", href: "/games" },
            { label: game.name, href: `/games/${game.slug}`, active: true },
          ]}
          primaryLinks={primaryLinks}
          categoryLinks={categoryLinks}
          gameLinks={gameLinks}
        />

        <div className="mt-10">
          <CommerceStage
            dataId="game-stage"
            eyebrow="Juego"
            title={game.name}
            description={`Descubre plugins, mapas y herramientas curadas especificamente para ${game.name}.`}
            surface="context"
            path={
              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
                <Link href="/products" className="hover:text-white">
                  Productos
                </Link>
                <span>/</span>
                <span className="text-white">{game.name}</span>
              </div>
            }
            stats={[
              { label: "Productos visibles", value: String(products?.length || 0) },
              { label: "Estado", value: "Marketplace activo" },
            ]}
          />
        </div>

        {topCategories.length > 0 ? (
          <section className="mt-12">
            <CommerceSectionHeading
              dataId="game-top-categories"
              eyebrow="Exploracion comparativa"
              title={`Top categorias en ${game.name}`}
              description="Explora las verticales con mas densidad de oferta dentro de este juego."
            />

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {topCategories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/products?game=${game.slug}&category=${category.slug}`}
                  className="block transition-transform hover:-translate-y-1"
                >
                  <Card className={`${commercePanelClassName("tile")} h-full p-5 hover:bg-white/[0.08]`}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">{category.name}</h3>
                      <Badge>{category.count}</Badge>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">
                      Entra en esta categoria dentro de {game.name} y reduce friccion en discovery.
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-12">
            <CommerceSectionHeading
              dataId="game-products"
              eyebrow="Shopping journey"
              title={`Productos destacados de ${game.name}`}
              description="Seleccion de recursos listos para descubrir, comparar y desplegar."
            />

          {products && products.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  title={product.title}
                  author={vendorById.get(product.vendor_id) || "ForjaDev"}
                  category={categoryById.get(product.category_id || "") || "Marketplace"}
                  price={product.is_free ? "Gratis" : `EUR ${(product.price_cents / 100).toFixed(2)}`}
                  compatibility={product.compatibility || game.name}
                  ratingAverage={product.rating_average}
                  ratingCount={product.rating_count}
                  qualitySnapshot={buildShoppingQualitySnapshot({
                    ratingAverage: product.rating_average,
                    ratingCount: product.rating_count,
                    supportPolicy: product.support_policy,
                    refundPolicy: product.refund_policy,
                    updatePolicy: product.update_policy,
                    lastUpdatedAt:
                      snapshotByVendorId.get(product.vendor_id)?.latest_product_update_at ||
                      product.updated_at,
                    sellerApprovedProducts:
                      snapshotByVendorId.get(product.vendor_id)?.approved_products || 0,
                    sellerTotalPurchases:
                      snapshotByVendorId.get(product.vendor_id)?.total_purchases || 0,
                    sellerIdentityVerified: verifiedUserIds.has(
                      vendorUserIdByVendorId.get(product.vendor_id) || ""
                    ),
                  })}
                  href={`/products/${product.slug}`}
                  imageUrl={product.featured_image_url}
                  tracking={{
                    pageType: "game",
                    entityId: product.id,
                    metadata: {
                      source: game.slug,
                    },
                  }}
                />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-[var(--text-soft)]">
                Aun no hay productos visibles para este juego.
              </p>
            </Card>
          )}
        </section>
      </section>
    </main>
  );
}
