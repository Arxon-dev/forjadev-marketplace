import type { Metadata } from "next";
import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { DiscoveryNavSpine } from "@/components/discovery/discovery-nav-spine";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { BundleCard } from "@/components/marketplace/bundle-card";
import { CommerceSectionHeading } from "@/components/marketplace/commerce-surface-system";
import { getPublicDealsForBundles } from "@/lib/promotions/public";
import { buildBundleListingMetadata } from "@/lib/seo/public-metadata";
import { createOptionalAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface BundleRow {
  id: string;
  vendor_id: string;
  title: string;
  slug: string;
  short_description: string | null;
  featured_image_url: string | null;
  price_cents: number;
}

interface BundleProduct {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  moderation_status: string;
  category_id: string | null;
  game_id: string | null;
}

interface BundleProductRow {
  bundle_id: string;
  sort_order: number;
  product: BundleProduct | BundleProduct[] | null;
}

interface BundleVendorRow {
  id: string;
  store_name: string;
}

interface BundleCategoryRow {
  id: string;
  name: string;
  slug: string;
}

interface BundleGameRow {
  id: string;
  name: string;
  slug: string;
}

function resolveBundleProduct(product: BundleProduct | BundleProduct[] | null): BundleProduct | null {
  return Array.isArray(product) ? (product[0] ?? null) : product;
}

export const metadata: Metadata = buildBundleListingMetadata();

export default async function BundlesPage() {
  const supabase = await createClient();
  const adminSupabase = createOptionalAdminClient();
  const queryClient = adminSupabase ?? supabase;

  const { data: bundlesData } = await queryClient
    .from("bundles")
    .select("id, vendor_id, title, slug, short_description, featured_image_url, price_cents")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const bundles = (bundlesData || []) as BundleRow[];
  const bundleIds = bundles.map((bundle) => bundle.id);
  const vendorIds = Array.from(new Set(bundles.map((bundle) => bundle.vendor_id)));

  const [bundleProductsResult, vendorsResult, snapshotsResult, categoriesResult, gamesResult] =
    await Promise.all([
      bundleIds.length > 0
        ? queryClient
            .from("bundle_products")
            .select(
              "bundle_id, sort_order, product:products!inner(id, title, slug, price_cents, moderation_status, category_id, game_id)"
            )
            .in("bundle_id", bundleIds)
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [] as BundleProductRow[] }),
      vendorIds.length > 0
        ? queryClient.from("vendors").select("id, store_name").in("id", vendorIds)
        : Promise.resolve({ data: [] as Array<{ id: string; store_name: string }> }),
      adminSupabase && vendorIds.length > 0
        ? adminSupabase
            .from("seller_reputation_snapshots")
            .select("vendor_id, approved_products, total_purchases")
            .in("vendor_id", vendorIds)
        : Promise.resolve({
          data: [] as Array<{
            vendor_id: string;
            approved_products: number;
            total_purchases: number;
          }>,
        }),
      queryClient
        .from("categories")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      queryClient
        .from("games")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

  const bundleProducts = ((bundleProductsResult.data || []) as BundleProductRow[]).reduce<
    Map<string, BundleProduct[]>
  >((map, item) => {
    const product = resolveBundleProduct(item.product);
    if (!product || product.moderation_status !== "approved") {
      return map;
    }

    const current = map.get(item.bundle_id) || [];
    current.push(product);
    map.set(item.bundle_id, current);
    return map;
  }, new Map());

  const bundleDeals = await getPublicDealsForBundles(
    bundles.map((bundle) => ({
      id: bundle.id,
      price_cents: bundle.price_cents,
    }))
  );

  const vendors = (vendorsResult.data || []) as BundleVendorRow[];
  const categories = (categoriesResult.data || []) as BundleCategoryRow[];
  const games = (gamesResult.data || []) as BundleGameRow[];

  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor.store_name]));
  const snapshotByVendorId = new Map(
    ((snapshotsResult.data || []) as Array<{
      vendor_id: string;
      approved_products: number;
      total_purchases: number;
    }>).map((snapshot) => [snapshot.vendor_id, snapshot])
  );

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const gameById = new Map(games.map((game) => [game.id, game]));
  const categoryCounts = new Map<string, number>();
  const gameCounts = new Map<string, number>();

  bundleProducts.forEach((products) => {
    products.forEach((product) => {
      if (product.category_id) {
        categoryCounts.set(product.category_id, (categoryCounts.get(product.category_id) || 0) + 1);
      }
      if (product.game_id) {
        gameCounts.set(product.game_id, (gameCounts.get(product.game_id) || 0) + 1);
      }
    });
  });

  const displayBundles = bundles
    .map((bundle) => {
      const includedProducts = bundleProducts.get(bundle.id) || [];
      if (includedProducts.length === 0) {
        return null;
      }

      const originalTotalCents = includedProducts.reduce((sum, product) => sum + product.price_cents, 0);
      const deal = bundleDeals.get(bundle.id) || null;
      const checkoutPriceCents = deal?.discountedPriceCents ?? bundle.price_cents;
      const savingsCents = Math.max(0, originalTotalCents - checkoutPriceCents);

      return {
        bundle,
        includedProducts,
        originalTotalCents,
        checkoutPriceCents,
        savingsCents,
        deal,
        snapshot: snapshotByVendorId.get(bundle.vendor_id),
      };
    })
    .filter(Boolean);

  const totalProductsIncluded = displayBundles.reduce(
    (sum, item) => sum + item!.includedProducts.length,
    0
  );
  const averageSavingsCents =
    displayBundles.length > 0
      ? Math.round(
          displayBundles.reduce((sum, item) => sum + item!.savingsCents, 0) / displayBundles.length
        )
      : 0;

  const topCategoryLinks = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([categoryId]) => categoryById.get(categoryId))
    .filter(Boolean)
    .map((category) => ({
      label: category!.name,
      href: `/categories/${category!.slug}`,
    }));

  const topGameLinks = [...gameCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([gameId]) => gameById.get(gameId))
    .filter(Boolean)
    .map((game) => ({
      label: game!.name,
      href: `/games/${game!.slug}`,
    }));

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker
        eventName="bundle.list.impression"
        pageType="bundle_catalog"
        metadata={{ bundleCount: displayBundles.length }}
      />
      <section className="container-shell py-16">
        <DiscoveryNavSpine
          eyebrow="Bundle Discovery"
          title="Explora bundles con valor comercial claro y continuidad real a compra"
          description="Encuentra packs activos que agrupan productos aprobados con mejor contexto comercial, ahorro visible y una ruta estable hacia detalle y checkout."
          path={[{ label: "Bundles", href: "/bundles", active: true }]}
          primaryLinks={[
            { label: "Bundles", href: "/bundles", active: true },
            { label: "Catalogo", href: "/products" },
            { label: "Categorias", href: "/categories" },
            { label: "Juegos", href: "/games" },
          ]}
          categoryLinks={topCategoryLinks}
          gameLinks={topGameLinks}
        />

        <div className="mt-10">
          <CommerceSectionHeading
            dataId="bundle-catalog"
            eyebrow="Bloque comercial"
            title="Bundles listos para descubrir, comparar y comprar"
            description="Cada bundle agrupa productos reales ya aprobados, mantiene continuidad hacia sus fichas y conserva una lectura comercial clara antes del checkout."
            aside={
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  {displayBundles.length} bundles activos
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  {totalProductsIncluded} productos incluidos
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  Ahorro medio EUR {(averageSavingsCents / 100).toFixed(2)}
                </span>
              </div>
            }
          />
        </div>

        {displayBundles.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {displayBundles.map((item) => (
              <BundleCard
                key={item!.bundle.id}
                title={item!.bundle.title}
                author={vendorById.get(item!.bundle.vendor_id) || "ForjaDev"}
                price={`EUR ${(item!.checkoutPriceCents / 100).toFixed(2)}`}
                originalPrice={
                  item!.checkoutPriceCents < item!.originalTotalCents
                    ? `EUR ${(item!.originalTotalCents / 100).toFixed(2)}`
                    : null
                }
                promoLabel={item!.deal?.promoLabel || null}
                itemCount={item!.includedProducts.length}
                savingsLabel={`Ahorro EUR ${(item!.savingsCents / 100).toFixed(2)}`}
                href={`/bundles/${item!.bundle.slug}`}
                imageUrl={item!.bundle.featured_image_url}
                shortDescription={item!.bundle.short_description}
                productPreview={item!.includedProducts.slice(0, 3).map((product) => product.title)}
                trustHighlights={[
                  "Checkout unico para varios productos del pack.",
                  "Cada producto mantiene su propia licencia y acceso postcompra.",
                  item!.snapshot && (item!.snapshot.approved_products >= 3 || item!.snapshot.total_purchases >= 25)
                    ? "Seller con actividad real y catalogo ya consolidado."
                    : "Bundle construido sobre productos aprobados del marketplace.",
                ]}
              />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-[1.9rem] border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">
              Aun no hay bundles activos publicados. Cuando lleguen, apareceran aqui como parte del browse comercial del marketplace.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
