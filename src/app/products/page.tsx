import type { Metadata } from "next";
import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { DiscoveryNavSpine } from "@/components/discovery/discovery-nav-spine";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { CommerceSectionHeading } from "@/components/marketplace/commerce-surface-system";
import { ProductCard } from "@/components/marketplace/product-card";
import { ProductFilters } from "@/components/marketplace/product-filters";
import { computeQualityTrustScore } from "@/lib/intelligence/catalog";
import { buildShoppingQualitySnapshot } from "@/lib/marketplace/quality-signals";
import { getPublicDealsForProducts } from "@/lib/promotions/public";
import { buildCatalogListingMetadata } from "@/lib/seo/public-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface ProductsPageProps {
  searchParams?: Promise<{
    q?: string;
    pricing?: string;
    sort?: string;
    game?: string;
    category?: string;
  }>;
}

export async function generateMetadata({
  searchParams,
}: ProductsPageProps): Promise<Metadata> {
  const params = (await searchParams) || {};
  const query = params.q?.trim() || "";
  const pricing = params.pricing || "all";
  const sort = params.sort || "newest";
  const game = params.game || "all";
  const category = params.category || "all";

  const supabase = await createClient();
  const [{ data: games }, { data: categories }] = await Promise.all([
    game !== "all"
      ? supabase.from("games").select("name, slug").eq("slug", game).maybeSingle()
      : Promise.resolve({ data: null }),
    category !== "all"
      ? supabase.from("categories").select("name, slug").eq("slug", category).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return buildCatalogListingMetadata({
    searchQuery: query,
    pricing,
    sort,
    gameName: games?.name || null,
    categoryName: categories?.name || null,
  });
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = (await searchParams) || {};
  const query = params.q?.trim() || "";
  const pricing = params.pricing || "all";
  const sort = params.sort || "newest";
  const game = params.game || "all";
  const category = params.category || "all";

  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const [{ data: games }, { data: categories }] = await Promise.all([
    supabase
      .from("games")
      .select("id, name, slug, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("categories")
      .select("id, name, slug, parent_id, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  let filteredProductIds: string[] | null = null;

  if (category !== "all") {
    const selectedCategory = (categories || []).find((item) => item.slug === category) || null;

    if (!selectedCategory) {
      filteredProductIds = [];
    } else {
      const relatedCategoryIds = [
        selectedCategory.id,
        ...(selectedCategory.parent_id === null
          ? (categories || [])
              .filter((item) => item.parent_id === selectedCategory.id)
              .map((item) => item.id)
          : []),
      ];

      const { data: mappings } = await supabase
        .from("product_categories")
        .select("product_id")
        .in("category_id", relatedCategoryIds);

      filteredProductIds = Array.from(new Set((mappings || []).map((item) => item.product_id)));
    }
  }

  let productsQuery = supabase
    .from("products")
    .select(
      "id, vendor_id, title, slug, price_cents, is_free, compatibility, featured_image_url, category_id, game_id, featured, rating_average, rating_count, download_count, purchase_count, created_at, updated_at, support_policy, refund_policy, update_policy"
    )
    .eq("moderation_status", "approved");

  if (query) {
    productsQuery = productsQuery.ilike("search_text", `%${query}%`);
  }

  if (pricing === "free") {
    productsQuery = productsQuery.eq("is_free", true);
  } else if (pricing === "paid") {
    productsQuery = productsQuery.eq("is_free", false);
  }

  if (game !== "all") {
    const selectedGame = (games || []).find((item) => item.slug === game) || null;

    if (selectedGame) {
      productsQuery = productsQuery.eq("game_id", selectedGame.id);
    } else {
      filteredProductIds = [];
    }
  }

  if (filteredProductIds) {
    if (filteredProductIds.length === 0) {
      productsQuery = productsQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      productsQuery = productsQuery.in("id", filteredProductIds);
    }
  }

  if (sort === "trending") {
    productsQuery = productsQuery
      .order("featured", { ascending: false })
      .order("purchase_count", { ascending: false })
      .order("download_count", { ascending: false })
      .order("rating_average", { ascending: false })
      .order("updated_at", { ascending: false });
  } else if (sort === "best_rated") {
    productsQuery = productsQuery
      .order("rating_average", { ascending: false })
      .order("rating_count", { ascending: false })
      .order("purchase_count", { ascending: false });
  } else if (sort === "most_downloaded") {
    productsQuery = productsQuery
      .order("download_count", { ascending: false })
      .order("purchase_count", { ascending: false })
      .order("updated_at", { ascending: false });
  } else if (sort === "updated") {
    productsQuery = productsQuery.order("updated_at", { ascending: false });
  } else if (sort === "price_asc") {
    productsQuery = productsQuery.order("price_cents", { ascending: true });
  } else if (sort === "price_desc") {
    productsQuery = productsQuery.order("price_cents", { ascending: false });
  } else if (sort === "title") {
    productsQuery = productsQuery.order("title", { ascending: true });
  } else {
    productsQuery = productsQuery.order("created_at", { ascending: false });
  }

  const { data: productsData } = await productsQuery;
  let products = productsData || [];

  if (sort === "quality_trust" && products.length > 0) {
    const vendorIdsForRanking = Array.from(new Set(products.map((product) => product.vendor_id)));
    const productIdsForRanking = products.map((product) => product.id);

    const [sellerReputationResult, sellerRiskResult, productRiskResult] = await Promise.all([
      adminSupabase
        .from("seller_reputation_snapshots")
        .select("vendor_id, reputation_score")
        .in("vendor_id", vendorIdsForRanking),
      adminSupabase
        .from("seller_risk_snapshots")
        .select("vendor_id, risk_score")
        .in("vendor_id", vendorIdsForRanking),
      adminSupabase
        .from("product_risk_snapshots")
        .select("product_id, risk_score")
        .in("product_id", productIdsForRanking),
    ]);

    const sellerReputationRows = (sellerReputationResult.data || []) as Array<{
      vendor_id: string;
      reputation_score: number;
    }>;
    const sellerRiskRows = (sellerRiskResult.data || []) as Array<{
      vendor_id: string;
      risk_score: number;
    }>;
    const productRiskRows = (productRiskResult.data || []) as Array<{
      product_id: string;
      risk_score: number;
    }>;

    const sellerReputationByVendorId = new Map(
      sellerReputationRows.map((item) => [item.vendor_id, item.reputation_score])
    );
    const sellerRiskByVendorId = new Map(
      sellerRiskRows.map((item) => [item.vendor_id, item.risk_score])
    );
    const productRiskByProductId = new Map(
      productRiskRows.map((item) => [item.product_id, item.risk_score])
    );

    products = [...products].sort((a, b) => {
      const scoreA = computeQualityTrustScore(
        a,
        {
          reputationScore: sellerReputationByVendorId.get(a.vendor_id) || 0,
          riskScore: sellerRiskByVendorId.get(a.vendor_id) || 0,
        },
        {
          riskScore: productRiskByProductId.get(a.id) || 0,
        }
      );
      const scoreB = computeQualityTrustScore(
        b,
        {
          reputationScore: sellerReputationByVendorId.get(b.vendor_id) || 0,
          riskScore: sellerRiskByVendorId.get(b.vendor_id) || 0,
        },
        {
          riskScore: productRiskByProductId.get(b.id) || 0,
        }
      );

      return (
        scoreB - scoreA ||
        b.purchase_count - a.purchase_count ||
        b.rating_average - a.rating_average ||
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }

  const vendorIds = Array.from(new Set((products || []).map((product) => product.vendor_id)));
  const categoryIds = Array.from(
    new Set((products || []).map((product) => product.category_id).filter(Boolean))
  );

  const [vendorsResult, productCategoriesResult] = await Promise.all([
    vendorIds.length > 0
      ? supabase.from("vendors").select("id, user_id, store_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; user_id: string; store_name: string }> }),
    categoryIds.length > 0
      ? supabase.from("categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);
  const vendorRows = vendorsResult.data || [];
  const vendorUserIds = Array.from(new Set(vendorRows.map((vendor) => vendor.user_id).filter(Boolean)));
  const [sellerSnapshotsResult, identitiesResult] = await Promise.all([
    vendorIds.length > 0
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
    vendorUserIds.length > 0
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
    (productCategoriesResult.data || []).map((item) => [item.id, item.name])
  );
  const dealsByProductId = await getPublicDealsForProducts(products || []);
  const rootCategories = (categories || []).filter((item) => item.parent_id === null);
  const selectedCategory = (categories || []).find((item) => item.slug === category) || null;
  const selectedGame = (games || []).find((item) => item.slug === game) || null;
  const primaryLinks = [
    { label: "Catalogo completo", href: "/products", active: game === "all" && category === "all" },
    { label: "Categorias", href: "/categories" },
    { label: "Juegos", href: "/games" },
  ];
  const topCategoryLinks = rootCategories.slice(0, 6).map((item) => ({
    label: item.name,
    href: `/categories/${item.slug}`,
    active: selectedCategory?.slug === item.slug,
  }));
  const topGameLinks = (games || []).slice(0, 6).map((item) => ({
    label: item.name,
    href: `/games/${item.slug}`,
    active: selectedGame?.slug === item.slug,
  }));

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker
        eventName="product.list.impression"
        pageType="catalog"
        metadata={{
          query,
          pricing,
          sort,
          game,
          category,
          resultCount: products?.length || 0,
        }}
      />
      <section className="container-shell py-16">
        <DiscoveryNavSpine
          eyebrow="Marketplace Browse"
          title="Descubre y compara productos desde una columna vertebral comun"
          description="Usa el catalogo completo, las categorias y los juegos como rutas estables para explorar oferta real antes de llegar a la ficha del producto."
          path={[
            { label: "Productos", href: "/products", active: game === "all" && category === "all" },
            ...(selectedGame
              ? [{ label: selectedGame.name, href: `/games/${selectedGame.slug}`, active: true }]
              : []),
            ...(selectedCategory
              ? [{ label: selectedCategory.name, href: `/categories/${selectedCategory.slug}`, active: true }]
              : []),
          ]}
          primaryLinks={primaryLinks}
          categoryLinks={topCategoryLinks}
          gameLinks={topGameLinks}
        />

        <div className="mt-10">
          <CommerceSectionHeading
            dataId="catalog-grid"
            eyebrow="Catalogo publico"
            title="Productos"
            description="Explora los productos aprobados que ya estan disponibles en el marketplace y entra en fichas con una lectura comercial mas consistente."
          />
        </div>
        {sort === "quality_trust" ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Orden inteligente activo: mezcla calidad del producto, reputacion del seller y penalizacion por riesgo operativo.
          </div>
        ) : null}

        <ProductFilters
          initialSearch={query}
          initialPricing={pricing}
          initialSort={sort}
          initialGame={game}
          initialCategory={category}
          games={(games || []).map((item) => ({
            slug: item.slug,
            name: item.name,
          }))}
          categories={(categories || []).map((item) => ({
            slug: item.slug,
            name: item.name,
            parent_id: item.parent_id,
          }))}
        />

        {products && products.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const deal = dealsByProductId.get(product.id);

              return (
                <ProductCard
                  key={product.id}
                  title={product.title}
                  author={vendorById.get(product.vendor_id) || "ForjaDev"}
                  category={categoryById.get(product.category_id || "") || "Marketplace"}
                  price={
                    product.is_free
                      ? "Gratis"
                      : `EUR ${((deal?.discountedPriceCents ?? product.price_cents) / 100).toFixed(2)}`
                  }
                    originalPrice={
                      deal && deal.discountedPriceCents < product.price_cents
                        ? `EUR ${(product.price_cents / 100).toFixed(2)}`
                        : null
                    }
                    promoLabel={deal?.promoLabel || null}
                  compatibility={product.compatibility || "Rust"}
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
                    pageType: "catalog",
                    entityId: product.id,
                    metadata: {
                      source: "catalog",
                      category: categoryById.get(product.category_id || "") || "Marketplace",
                      game,
                      hasDeal: Boolean(deal),
                    },
                  }}
                />
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">
              No encontramos productos para estos filtros.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
