import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Hero } from "@/components/marketplace/hero";
import { BrowseCategories } from "@/components/home/browse-categories";
import { DiscoveryRail } from "@/components/home/discovery-rail";
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

function formatRailProducts(
  products: DiscoveryProductRow[],
  vendorById: Map<string, string>,
  categoryById: Map<string, string>
) {
  return products.map((product) => ({
    id: product.id,
    title: product.title,
    author: vendorById.get(product.vendor_id) || "ForjaDev",
    category: categoryById.get(product.category_id || "") || "Marketplace",
    price: product.is_free ? "Gratis" : `EUR ${(product.price_cents / 100).toFixed(2)}`,
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
      },
    },
  }));
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

  const [featuredResult, trendingResult, updatedResult, categoriesResult] = await Promise.all([
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
  const vendorIds = Array.from(new Set(allProducts.map((product) => product.vendor_id)));
  const categoryIds = Array.from(
    new Set(allProducts.map((product) => product.category_id).filter(Boolean))
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

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker eventName="homepage.visited" pageType="home" />
      <Hero />

      <section className="container-shell pb-20">
        <BrowseCategories categories={categoriesResult.data || []} />

        <DiscoveryRail
          title="Destacados"
          description="Selecciones premium para empezar con los productos mas visibles del marketplace."
          products={formatRailProducts(featuredProducts, vendorById, categoryById)}
        />

        <DiscoveryRail
          title="En tendencia"
          description="Productos que concentran mas actividad reciente en compras, descargas y traccion."
          products={formatRailProducts(trendingProducts, vendorById, categoryById)}
        />

        <DiscoveryRail
          title="Recien actualizados"
          description="Novedades y mejoras recientes para usuarios que buscan proyectos activos."
          products={formatRailProducts(updatedProducts, vendorById, categoryById)}
        />
      </section>
    </main>
  );
}
