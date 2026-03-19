import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { BrowseCategories } from "@/components/home/browse-categories";
import { DiscoveryRail } from "@/components/home/discovery-rail";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Hero } from "@/components/marketplace/hero";
import { getPersonalizedRecommendations } from "@/lib/intelligence/recommendations";
import type { PublicDeal } from "@/lib/promotions/public";
import { getPublicDealsForBundles, getPublicDealsForProducts, getPublicFeaturedPlacements } from "@/lib/promotions/public";
import { createClient } from "@/lib/supabase/server";

interface DiscoveryProductRow {
  id: string;
  vendor_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  price_cents: number;
  is_free: boolean;
  compatibility: string | null;
  featured_image_url: string | null;
  rating_average: number;
  rating_count: number;
}

interface DiscoveryBundleRow {
  id: string;
  vendor_id: string;
  title: string;
  slug: string;
  price_cents: number;
  featured_image_url: string | null;
}

interface PlacementRailItem {
  id: string;
  title: string;
  author: string;
  category: string;
  price: string;
  originalPrice?: string | null;
  promoLabel?: string | null;
  compatibility: string;
  ratingAverage?: number | null;
  ratingCount?: number;
  href: string;
  imageUrl?: string | null;
  tracking?: {
    pageType: string;
    entityType?: string;
    entityId: string;
    metadata?: Record<string, unknown> | null;
  };
}

type RailDealMap = Map<string, PublicDeal>;

function formatRailProducts(
  products: DiscoveryProductRow[],
  vendorById: Map<string, string>,
  categoryById: Map<string, string>,
  dealsByProductId: RailDealMap
) {
  return products.map((product) => {
    const deal = dealsByProductId.get(product.id);

    return {
      id: product.id,
      title: product.title,
      author: vendorById.get(product.vendor_id) || "ForjaDev",
      category: categoryById.get(product.category_id || "") || "Marketplace",
      price: product.is_free
        ? "Gratis"
        : `EUR ${((deal?.discountedPriceCents ?? product.price_cents) / 100).toFixed(2)}`,
      originalPrice:
        deal && deal.discountedPriceCents < product.price_cents
          ? `EUR ${(product.price_cents / 100).toFixed(2)}`
          : null,
      promoLabel: deal?.promoLabel || null,
      compatibility: product.compatibility || "Rust",
      ratingAverage: product.rating_average,
      ratingCount: product.rating_count,
      href: `/products/${product.slug}`,
      imageUrl: product.featured_image_url,
      tracking: {
        pageType: "home",
        entityId: product.id,
        metadata: {
          source: "home",
          category: categoryById.get(product.category_id || "") || "Marketplace",
          hasDeal: Boolean(deal),
        },
      },
    };
  });
}

function pickUniqueProducts(
  products: DiscoveryProductRow[],
  usedIds: Set<string>,
  limit: number
) {
  const nextProducts: DiscoveryProductRow[] = [];

  for (const product of products) {
    if (usedIds.has(product.id)) {
      continue;
    }

    usedIds.add(product.id);
    nextProducts.push(product);

    if (nextProducts.length === limit) {
      break;
    }
  }

  return nextProducts;
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const featuredPlacements = await getPublicFeaturedPlacements(6);
  const personalizedProducts = user
    ? await getPersonalizedRecommendations(user.id, 3)
    : [];
  const placementProductIds = featuredPlacements
    .filter((item) => item.entityType === "product")
    .map((item) => item.entityId);
  const placementBundleIds = featuredPlacements
    .filter((item) => item.entityType === "bundle")
    .map((item) => item.entityId);

  const [featuredResult, trendingResult, updatedResult, categoriesResult, placementProductsResult, placementBundlesResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, vendor_id, category_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count"
      )
      .eq("moderation_status", "approved")
      .eq("featured", true)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("products")
      .select(
        "id, vendor_id, category_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count"
      )
      .eq("moderation_status", "approved")
      .order("purchase_count", { ascending: false })
      .order("download_count", { ascending: false })
      .order("rating_average", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(9),
    supabase
      .from("products")
      .select(
        "id, vendor_id, category_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count"
      )
      .eq("moderation_status", "approved")
      .order("updated_at", { ascending: false })
      .limit(9),
    supabase
      .from("categories")
      .select("id, name, slug, description, parent_id, sort_order")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(4),
    placementProductIds.length > 0
      ? supabase
          .from("products")
          .select(
            "id, vendor_id, category_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count"
          )
          .eq("moderation_status", "approved")
          .in("id", placementProductIds)
      : Promise.resolve({ data: [] as DiscoveryProductRow[] }),
    placementBundleIds.length > 0
      ? supabase
          .from("bundles")
          .select("id, vendor_id, title, slug, price_cents, featured_image_url")
          .eq("is_active", true)
          .in("id", placementBundleIds)
      : Promise.resolve({ data: [] as DiscoveryBundleRow[] }),
  ]);

  const fallbackFeaturedResult =
    (featuredResult.data || []).length === 0
      ? await supabase
          .from("products")
          .select(
            "id, vendor_id, category_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count"
          )
          .eq("moderation_status", "approved")
          .order("created_at", { ascending: false })
          .limit(6)
      : null;

  const featuredProductsSource = (
    featuredResult.data ||
    fallbackFeaturedResult?.data ||
    []
  ) as DiscoveryProductRow[];
  const trendingProductsSource = (trendingResult.data || []) as DiscoveryProductRow[];
  const updatedProductsSource = (updatedResult.data || []) as DiscoveryProductRow[];

  const usedProductIds = new Set<string>();
  const featuredProducts = pickUniqueProducts(featuredProductsSource, usedProductIds, 3);
  const trendingProducts = pickUniqueProducts(trendingProductsSource, usedProductIds, 3);
  const updatedProducts = pickUniqueProducts(updatedProductsSource, usedProductIds, 3);

  const allProducts = [...featuredProducts, ...trendingProducts, ...updatedProducts];
  const dealProducts = pickUniqueProducts(
    [...featuredProductsSource, ...trendingProductsSource, ...updatedProductsSource],
    new Set<string>(),
    12
  );
  const lookupProducts = [...allProducts, ...dealProducts];
  const placementProducts = (placementProductsResult.data || []) as DiscoveryProductRow[];
  const placementBundles = (placementBundlesResult.data || []) as DiscoveryBundleRow[];

  const vendorIds = Array.from(
    new Set([
      ...lookupProducts.map((product) => product.vendor_id),
      ...placementProducts.map((product) => product.vendor_id),
      ...placementBundles.map((bundle) => bundle.vendor_id),
    ])
  );
  const categoryIds = Array.from(
    new Set([
      ...lookupProducts.map((product) => product.category_id).filter(Boolean),
      ...placementProducts.map((product) => product.category_id).filter(Boolean),
    ])
  );

  const [vendorsResult, categoryLookupResult] = await Promise.all([
    vendorIds.length > 0
      ? supabase.from("vendors").select("id, store_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; store_name: string }> }),
    categoryIds.length > 0
      ? supabase.from("categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const vendorById = new Map(
    (vendorsResult.data || []).map((vendor) => [vendor.id, vendor.store_name])
  );
  const categoryById = new Map(
    (categoryLookupResult.data || []).map((category) => [category.id, category.name])
  );

  const dealsByProductId = await getPublicDealsForProducts(dealProducts);
  const placementDealsByProductId = await getPublicDealsForProducts(placementProducts);
  const placementDealsByBundleId = await getPublicDealsForBundles(placementBundles);
  const dealRailProducts = dealProducts
    .filter((product) => dealsByProductId.has(product.id))
    .slice(0, 3);
  const placementProductsById = new Map(placementProducts.map((product) => [product.id, product]));
  const placementBundlesById = new Map(placementBundles.map((bundle) => [bundle.id, bundle]));
  const placementRailItems = featuredPlacements.reduce<PlacementRailItem[]>((items, placement) => {
    if (placement.entityType === "product") {
      const product = placementProductsById.get(placement.entityId);
      if (!product) {
        return items;
      }

      const deal = placementDealsByProductId.get(product.id);
      items.push({
        id: `product:${product.id}`,
        title: product.title,
        author: vendorById.get(product.vendor_id) || "ForjaDev",
        category: categoryById.get(product.category_id || "") || "Marketplace",
        price: product.is_free
          ? "Gratis"
          : `EUR ${((deal?.discountedPriceCents ?? product.price_cents) / 100).toFixed(2)}`,
        originalPrice:
          deal && deal.discountedPriceCents < product.price_cents
            ? `EUR ${(product.price_cents / 100).toFixed(2)}`
            : null,
        promoLabel: deal?.promoLabel || "PLACEMENT PREMIUM",
        compatibility: product.compatibility || "Rust",
        ratingAverage: product.rating_average,
        ratingCount: product.rating_count,
        href: `/products/${product.slug}`,
        imageUrl: product.featured_image_url,
        tracking: {
          pageType: "home",
          entityType: "product",
          entityId: product.id,
          metadata: {
            source: "featured_placement",
            placementTitle: placement.title,
            hasDeal: Boolean(deal),
          },
        },
      });

      return items;
    }

    const bundle = placementBundlesById.get(placement.entityId);
    if (!bundle) {
      return items;
    }

    const deal = placementDealsByBundleId.get(bundle.id);
    items.push({
      id: `bundle:${bundle.id}`,
      title: bundle.title,
      author: vendorById.get(bundle.vendor_id) || "ForjaDev",
      category: "Bundle premium",
      price: `EUR ${((deal?.discountedPriceCents ?? bundle.price_cents) / 100).toFixed(2)}`,
      originalPrice:
        deal && deal.discountedPriceCents < bundle.price_cents
          ? `EUR ${(bundle.price_cents / 100).toFixed(2)}`
          : null,
      promoLabel: deal?.promoLabel || "PLACEMENT PREMIUM",
      compatibility: "Bundle",
      ratingAverage: null,
      ratingCount: 0,
      href: `/bundles/${bundle.slug}`,
      imageUrl: bundle.featured_image_url,
      tracking: {
        pageType: "home",
        entityType: "bundle",
        entityId: bundle.id,
        metadata: {
          source: "featured_placement",
          placementTitle: placement.title,
          hasDeal: Boolean(deal),
        },
      },
    });

    return items;
  }, []);

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker eventName="homepage.visited" pageType="home" />
      <Hero />

      <section className="container-shell pb-20">
        <BrowseCategories categories={categoriesResult.data || []} />

        <DiscoveryRail
          title="Para ti"
          description="Una capa personalizada para volver al marketplace con mas contexto: wishlist, compras, descargas y sellers seguidos."
          products={personalizedProducts.map((product) => ({
            id: product.id,
            title: product.title,
            author: product.author,
            category: product.categoryName,
            price: product.is_free ? "Gratis" : `EUR ${(product.price_cents / 100).toFixed(2)}`,
            promoLabel: product.recommendationReason,
            compatibility: product.compatibility || "Rust",
            ratingAverage: product.rating_average,
            ratingCount: product.rating_count,
            href: `/products/${product.slug}`,
            imageUrl: product.featured_image_url,
            tracking: {
              pageType: "home",
              entityId: product.id,
              metadata: {
                source: "personalized_home",
                reason: product.recommendationReason,
              },
            },
          }))}
        />

        <DiscoveryRail
          title="Placements premium"
          description="Posiciones promocionadas para productos y bundles que quieren la maxima visibilidad dentro del catalogo."
          products={placementRailItems}
        />

        <DiscoveryRail
          title="Deals activos"
          description="Ofertas visibles ahora mismo para compradores que quieren maximizar valor sin salir del marketplace."
          products={formatRailProducts(dealRailProducts, vendorById, categoryById, dealsByProductId)}
        />

        <DiscoveryRail
          title="Destacados"
          description="Selecciones premium para empezar con los productos mas visibles del marketplace."
          products={formatRailProducts(featuredProducts, vendorById, categoryById, dealsByProductId)}
        />

        <DiscoveryRail
          title="En tendencia"
          description="Productos que concentran mas actividad reciente en compras, descargas y traccion."
          products={formatRailProducts(trendingProducts, vendorById, categoryById, dealsByProductId)}
        />

        <DiscoveryRail
          title="Recien actualizados"
          description="Novedades y mejoras recientes para usuarios que buscan proyectos activos."
          products={formatRailProducts(updatedProducts, vendorById, categoryById, dealsByProductId)}
        />
      </section>
    </main>
  );
}
