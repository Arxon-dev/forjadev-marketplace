import type { Metadata } from "next";
import { MarketplaceTracker } from "@/components/analytics/marketplace-tracker";
import { DiscoveryNavSpine } from "@/components/discovery/discovery-nav-spine";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { BundleCard } from "@/components/marketplace/bundle-card";
import {
  CommerceSectionHeading,
  CommerceStage,
} from "@/components/marketplace/commerce-surface-system";
import { ProductCard } from "@/components/marketplace/product-card";
import { buildShoppingQualitySnapshot } from "@/lib/marketplace/quality-signals";
import {
  getPublicDealsForBundles,
  getPublicDealsForProducts,
  getPublicFeaturedPlacements,
} from "@/lib/promotions/public";
import { buildDealsListingMetadata } from "@/lib/seo/public-metadata";
import { createOptionalAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface ProductRow {
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
  support_policy: string | null;
  refund_policy: string | null;
  update_policy: string | null;
  updated_at: string;
}

interface BundleRow {
  id: string;
  vendor_id: string;
  title: string;
  slug: string;
  short_description: string | null;
  featured_image_url: string | null;
  price_cents: number;
}

interface CampaignRow {
  title: string;
  product_id: string | null;
  bundle_id: string | null;
  campaign_type: "flash_deal" | "launch_discount" | "featured_placement";
  discount_type: "percent" | "fixed" | null;
  discount_value: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface VendorRow {
  id: string;
  user_id: string;
  store_name: string;
}

interface SellerSnapshotRow {
  vendor_id: string;
  approved_products: number;
  total_purchases: number;
  latest_product_update_at: string | null;
}

interface IdentityRow {
  user_id: string;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
}

interface GameRow {
  id: string;
  name: string;
  slug: string;
}

interface BundleProductRecord {
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
  product: BundleProductRecord | BundleProductRecord[] | null;
}

function isCampaignLive(campaign: CampaignRow, nowIso: string) {
  if (!campaign.is_active) {
    return false;
  }

  if (campaign.starts_at && campaign.starts_at > nowIso) {
    return false;
  }

  if (campaign.ends_at && campaign.ends_at < nowIso) {
    return false;
  }

  return true;
}

function resolveBundleProduct(product: BundleProductRow["product"]) {
  return Array.isArray(product) ? (product[0] ?? null) : product;
}

export const metadata: Metadata = buildDealsListingMetadata();

export default async function DealsPage() {
  const supabase = await createClient();
  const adminSupabase = createOptionalAdminClient();
  const queryClient = adminSupabase ?? supabase;
  const nowIso = new Date().toISOString();

  const { data: campaignsData } = adminSupabase
    ? await adminSupabase
        .from("campaigns")
        .select(
          "title, product_id, bundle_id, campaign_type, discount_type, discount_value, starts_at, ends_at, is_active, created_at"
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(60)
    : { data: [] as CampaignRow[] };

  const campaigns = ((campaignsData || []) as CampaignRow[]).filter((campaign) =>
    isCampaignLive(campaign, nowIso)
  );
  const featuredPlacements = await getPublicFeaturedPlacements(6);

  const productCampaigns = campaigns.filter(
    (campaign) =>
      campaign.product_id &&
      campaign.campaign_type !== "featured_placement" &&
      campaign.discount_type &&
      campaign.discount_value
  );
  const bundleCampaigns = campaigns.filter(
    (campaign) =>
      campaign.bundle_id &&
      campaign.campaign_type !== "featured_placement" &&
      campaign.discount_type &&
      campaign.discount_value
  );

  const productIds = Array.from(
    new Set(productCampaigns.map((campaign) => campaign.product_id).filter(Boolean))
  ) as string[];
  const bundleIds = Array.from(
    new Set(bundleCampaigns.map((campaign) => campaign.bundle_id).filter(Boolean))
  ) as string[];
  const placementProductIds = featuredPlacements
    .filter((item) => item.entityType === "product")
    .map((item) => item.entityId);
  const placementBundleIds = featuredPlacements
    .filter((item) => item.entityType === "bundle")
    .map((item) => item.entityId);
  const allProductIds = Array.from(new Set([...productIds, ...placementProductIds]));
  const allBundleIds = Array.from(new Set([...bundleIds, ...placementBundleIds]));

  const [productsResult, bundlesResult, bundleProductsResult] = await Promise.all([
    allProductIds.length > 0
      ? queryClient
          .from("products")
          .select(
            "id, vendor_id, category_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count, support_policy, refund_policy, update_policy, updated_at"
          )
          .eq("moderation_status", "approved")
          .in("id", allProductIds)
      : Promise.resolve({ data: [] as ProductRow[] }),
    allBundleIds.length > 0
      ? queryClient
          .from("bundles")
          .select("id, vendor_id, title, slug, short_description, featured_image_url, price_cents")
          .eq("is_active", true)
          .in("id", allBundleIds)
      : Promise.resolve({ data: [] as BundleRow[] }),
    allBundleIds.length > 0
      ? queryClient
          .from("bundle_products")
          .select(
            "bundle_id, sort_order, product:products!inner(id, title, slug, price_cents, moderation_status, category_id, game_id)"
          )
          .in("bundle_id", allBundleIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as BundleProductRow[] }),
  ]);

  const products = (productsResult.data || []) as ProductRow[];
  const bundles = (bundlesResult.data || []) as BundleRow[];
  const bundleProductsRows = (bundleProductsResult.data || []) as BundleProductRow[];

  const vendorIds = Array.from(
    new Set([...products.map((product) => product.vendor_id), ...bundles.map((bundle) => bundle.vendor_id)])
  );
  const categoryIds = Array.from(new Set(products.map((product) => product.category_id).filter(Boolean))) as string[];
  const vendorRowsPromise =
    vendorIds.length > 0
      ? queryClient.from("vendors").select("id, user_id, store_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as VendorRow[] });
  const categoriesPromise =
    categoryIds.length > 0
      ? queryClient.from("categories").select("id, name, slug").in("id", categoryIds)
      : Promise.resolve({ data: [] as CategoryRow[] });

  const [vendorsResult, categoriesResult] = await Promise.all([vendorRowsPromise, categoriesPromise]);
  const vendors = (vendorsResult.data || []) as VendorRow[];
  const categories = (categoriesResult.data || []) as CategoryRow[];
  const vendorUserIds = Array.from(new Set(vendors.map((vendor) => vendor.user_id).filter(Boolean)));
  const gameIds = Array.from(
    new Set(bundleProductsRows.map((row) => resolveBundleProduct(row.product)?.game_id).filter(Boolean))
  ) as string[];

  const [snapshotsResult, identitiesResult, gamesResult] = await Promise.all([
    adminSupabase && vendorIds.length > 0
      ? adminSupabase
          .from("seller_reputation_snapshots")
          .select("vendor_id, approved_products, total_purchases, latest_product_update_at")
          .in("vendor_id", vendorIds)
      : Promise.resolve({ data: [] as SellerSnapshotRow[] }),
    adminSupabase && vendorUserIds.length > 0
      ? adminSupabase.from("user_provider_identities").select("user_id").in("user_id", vendorUserIds)
      : Promise.resolve({ data: [] as IdentityRow[] }),
    gameIds.length > 0
      ? queryClient.from("games").select("id, name, slug").in("id", gameIds)
      : Promise.resolve({ data: [] as GameRow[] }),
  ]);

  const snapshots = (snapshotsResult.data || []) as SellerSnapshotRow[];
  const identities = (identitiesResult.data || []) as IdentityRow[];
  const games = (gamesResult.data || []) as GameRow[];

  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const snapshotByVendorId = new Map(snapshots.map((snapshot) => [snapshot.vendor_id, snapshot]));
  const verifiedUserIds = new Set(identities.map((identity) => identity.user_id));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const gameById = new Map(games.map((game) => [game.id, game]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const bundleById = new Map(bundles.map((bundle) => [bundle.id, bundle]));

  const bundleProducts = bundleProductsRows.reduce<Map<string, BundleProductRecord[]>>((map, row) => {
    const product = resolveBundleProduct(row.product);
    if (!product || product.moderation_status !== "approved") {
      return map;
    }

    const current = map.get(row.bundle_id) || [];
    current.push(product);
    map.set(row.bundle_id, current);
    return map;
  }, new Map());

  const productDealsById = await getPublicDealsForProducts(
    products.map((product) => ({
      id: product.id,
      price_cents: product.price_cents,
      is_free: product.is_free,
    }))
  );
  const bundleDealsById = await getPublicDealsForBundles(
    bundles.map((bundle) => ({
      id: bundle.id,
      price_cents: bundle.price_cents,
    }))
  );

  const bestProductCampaignById = new Map<string, CampaignRow>();
  for (const campaign of productCampaigns) {
    if (!campaign.product_id) continue;
    if (!productDealsById.get(campaign.product_id)) continue;
    bestProductCampaignById.set(campaign.product_id, campaign);
  }

  const bestBundleCampaignById = new Map<string, CampaignRow>();
  for (const campaign of bundleCampaigns) {
    if (!campaign.bundle_id) continue;
    if (!bundleDealsById.get(campaign.bundle_id)) continue;
    bestBundleCampaignById.set(campaign.bundle_id, campaign);
  }

  const liveProductDeals = Array.from(bestProductCampaignById.entries())
    .map(([productId, campaign]) => {
      const product = productById.get(productId);
      const deal = productDealsById.get(productId);
      if (!product || !deal || deal.source !== "campaign") return null;
      return {
        product,
        campaign,
        deal,
        vendor: vendorById.get(product.vendor_id),
        snapshot: snapshotByVendorId.get(product.vendor_id),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.deal.savingsCents - a!.deal.savingsCents)
    .slice(0, 9);

  const liveBundleDeals = Array.from(bestBundleCampaignById.entries())
    .map(([bundleId, campaign]) => {
      const bundle = bundleById.get(bundleId);
      const deal = bundleDealsById.get(bundleId);
      const includedProducts = bundleProducts.get(bundleId) || [];
      if (!bundle || !deal || deal.source !== "campaign" || includedProducts.length === 0) return null;
      const originalTotalCents = includedProducts.reduce((sum, item) => sum + item.price_cents, 0);
      return {
        bundle,
        campaign,
        deal,
        vendor: vendorById.get(bundle.vendor_id),
        snapshot: snapshotByVendorId.get(bundle.vendor_id),
        includedProducts,
        originalTotalCents,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.deal.savingsCents - a!.deal.savingsCents)
    .slice(0, 6);

  const placementItems = featuredPlacements
    .map((placement) => {
      if (placement.entityType === "product") {
        const product = productById.get(placement.entityId);
        if (!product) return null;
        return {
          entityType: "product" as const,
          placement,
          product,
          vendor: vendorById.get(product.vendor_id),
          snapshot: snapshotByVendorId.get(product.vendor_id),
        };
      }

      const bundle = bundleById.get(placement.entityId);
      if (!bundle) return null;
      return {
        entityType: "bundle" as const,
        placement,
        bundle,
        vendor: vendorById.get(bundle.vendor_id),
        snapshot: snapshotByVendorId.get(bundle.vendor_id),
        includedProducts: bundleProducts.get(bundle.id) || [],
      };
    })
    .filter(Boolean);

  const topCategoryLinks = liveProductDeals
    .map((item) => categoryById.get(item!.product.category_id || ""))
    .filter(Boolean)
    .slice(0, 6)
    .map((category) => ({ label: category!.name, href: `/categories/${category!.slug}` }));

  const topGameLinks = liveBundleDeals
    .flatMap((item) => item!.includedProducts)
    .map((product) => gameById.get(product.game_id || ""))
    .filter(Boolean)
    .slice(0, 6)
    .map((game) => ({ label: game!.name, href: `/games/${game!.slug}` }));

  return (
    <main>
      <SiteHeaderServer />
      <MarketplaceTracker
        eventName="deals.visited"
        pageType="deals"
        metadata={{
          productDealCount: liveProductDeals.length,
          bundleDealCount: liveBundleDeals.length,
          placementCount: placementItems.length,
        }}
      />
      <section className="container-shell py-16">
        <CommerceStage
          dataId="deals-stage"
          eyebrow="Campaigns & Merchandising"
          title="Campanas y deals activos listos para discovery, comparacion y compra"
          description="La capa promocional deja de sentirse accesoria: ahora vive en una superficie publica propia con continuidad real hacia producto y bundle."
          align="split"
          actions={[
            { label: "Explorar deals", href: "/deals", variant: "primary" },
            { label: "Ver catalogo", href: "/products", variant: "secondary" },
            { label: "Ver bundles", href: "/bundles", variant: "secondary" },
          ]}
          stats={[
            { label: "Placements", value: String(placementItems.length) },
            { label: "Deals producto", value: String(liveProductDeals.length) },
            { label: "Deals bundle", value: String(liveBundleDeals.length) },
            { label: "Continuidad", value: "Producto y bundle" },
          ]}
        />

        <div className="mt-10">
          <DiscoveryNavSpine
            eyebrow="Merchandising Spine"
            title="Una columna comercial unica para placements y descuentos activos"
            description="Campaigns deja de vivir solo en home o en paneles internos y pasa a tener browse publico, continuidad comercial y mejor legibilidad promocional."
            path={[{ label: "Deals", href: "/deals", active: true }]}
            primaryLinks={[
              { label: "Deals", href: "/deals", active: true },
              { label: "Catalogo", href: "/products" },
              { label: "Bundles", href: "/bundles" },
              { label: "Categorias", href: "/categories" },
            ]}
            categoryLinks={topCategoryLinks}
            gameLinks={topGameLinks}
          />
        </div>

        <section className="mt-12" data-merchandising-surface="placements">
          <CommerceSectionHeading
            dataId="deals-placements"
            eyebrow="Placements premium"
            title="Posiciones promocionadas con continuidad real a compra"
            description="Los placements premium dejan de ser un rail aislado y pasan a tener una superficie de browse propia dentro del marketplace."
          />
          {placementItems.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {placementItems.map((item) =>
                item!.entityType === "product" ? (
                  <ProductCard
                    key={`placement-product-${item!.product.id}`}
                    title={item!.product.title}
                    author={item!.vendor?.store_name || "ForjaDev"}
                    category={categoryById.get(item!.product.category_id || "")?.name || "Marketplace"}
                    price={
                      item!.product.is_free
                        ? "Gratis"
                        : `EUR ${(item!.product.price_cents / 100).toFixed(2)}`
                    }
                    promoLabel={item!.placement.title || "PLACEMENT PREMIUM"}
                    compatibility={item!.product.compatibility || "Rust"}
                    ratingAverage={item!.product.rating_average}
                    ratingCount={item!.product.rating_count}
                    qualitySnapshot={buildShoppingQualitySnapshot({
                      ratingAverage: item!.product.rating_average,
                      ratingCount: item!.product.rating_count,
                      supportPolicy: item!.product.support_policy,
                      refundPolicy: item!.product.refund_policy,
                      updatePolicy: item!.product.update_policy,
                      lastUpdatedAt: item!.snapshot?.latest_product_update_at || item!.product.updated_at,
                      sellerApprovedProducts: item!.snapshot?.approved_products || 0,
                      sellerTotalPurchases: item!.snapshot?.total_purchases || 0,
                      sellerIdentityVerified: verifiedUserIds.has(item!.vendor?.user_id || ""),
                    })}
                    href={`/products/${item!.product.slug}`}
                    imageUrl={item!.product.featured_image_url}
                  />
                ) : (
                  <BundleCard
                    key={`placement-bundle-${item!.bundle.id}`}
                    title={item!.bundle.title}
                    author={item!.vendor?.store_name || "ForjaDev"}
                    price={`EUR ${(item!.bundle.price_cents / 100).toFixed(2)}`}
                    itemCount={item!.includedProducts.length}
                    savingsLabel="Placement premium"
                    promoLabel={item!.placement.title || "PLACEMENT PREMIUM"}
                    href={`/bundles/${item!.bundle.slug}`}
                    imageUrl={item!.bundle.featured_image_url}
                    shortDescription={item!.bundle.short_description}
                    productPreview={item!.includedProducts.slice(0, 3).map((product) => product.title)}
                    trustHighlights={[
                      "Placement activo dentro del marketplace.",
                      "Continuidad directa a bundle y checkout.",
                      item!.snapshot && item!.snapshot.total_purchases >= 25
                        ? "Seller con historial comercial visible."
                        : "Bundle respaldado por productos aprobados.",
                    ]}
                  />
                )
              )}
            </div>
          ) : (
            <div className="rounded-[1.9rem] border border-white/10 bg-white/5 px-6 py-12 text-center text-[var(--text-soft)]">
              No hay placements premium activos ahora mismo.
            </div>
          )}
        </section>

        <section className="mt-16" data-merchandising-surface="product-deals">
          <CommerceSectionHeading
            dataId="deals-products"
            eyebrow="Deals de producto"
            title="Flash deals y launch discounts con valor promocional claro"
            description="Las campanas de producto dejan de ser solo reglas de checkout y se vuelven browseables como bloque comercial visible."
          />
          {liveProductDeals.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {liveProductDeals.map((item) => (
                <ProductCard
                  key={`deal-product-${item!.product.id}`}
                  title={item!.product.title}
                  author={item!.vendor?.store_name || "ForjaDev"}
                  category={categoryById.get(item!.product.category_id || "")?.name || "Marketplace"}
                  price={`EUR ${(item!.deal.discountedPriceCents / 100).toFixed(2)}`}
                  originalPrice={`EUR ${(item!.product.price_cents / 100).toFixed(2)}`}
                  promoLabel={item!.campaign.title || item!.deal.promoLabel}
                  compatibility={item!.product.compatibility || "Rust"}
                  ratingAverage={item!.product.rating_average}
                  ratingCount={item!.product.rating_count}
                  qualitySnapshot={buildShoppingQualitySnapshot({
                    ratingAverage: item!.product.rating_average,
                    ratingCount: item!.product.rating_count,
                    supportPolicy: item!.product.support_policy,
                    refundPolicy: item!.product.refund_policy,
                    updatePolicy: item!.product.update_policy,
                    lastUpdatedAt: item!.snapshot?.latest_product_update_at || item!.product.updated_at,
                    sellerApprovedProducts: item!.snapshot?.approved_products || 0,
                    sellerTotalPurchases: item!.snapshot?.total_purchases || 0,
                    sellerIdentityVerified: verifiedUserIds.has(item!.vendor?.user_id || ""),
                  })}
                  href={`/products/${item!.product.slug}`}
                  imageUrl={item!.product.featured_image_url}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.9rem] border border-white/10 bg-white/5 px-6 py-12 text-center text-[var(--text-soft)]">
              No hay deals activos de producto ahora mismo.
            </div>
          )}
        </section>

        <section className="mt-16" data-merchandising-surface="bundle-deals">
          <CommerceSectionHeading
            dataId="deals-bundles"
            eyebrow="Bundles en campana"
            title="Packs promocionados con ahorro visible y continuidad a checkout"
            description="Los bundles en campana ya no quedan ocultos dentro del browse general y pasan a tener una presencia comercial propia."
          />
          {liveBundleDeals.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {liveBundleDeals.map((item) => (
                <BundleCard
                  key={`deal-bundle-${item!.bundle.id}`}
                  title={item!.bundle.title}
                  author={item!.vendor?.store_name || "ForjaDev"}
                  price={`EUR ${(item!.deal.discountedPriceCents / 100).toFixed(2)}`}
                  originalPrice={`EUR ${(item!.originalTotalCents / 100).toFixed(2)}`}
                  promoLabel={item!.campaign.title || item!.deal.promoLabel}
                  itemCount={item!.includedProducts.length}
                  savingsLabel={`Ahorro EUR ${(item!.deal.savingsCents / 100).toFixed(2)}`}
                  href={`/bundles/${item!.bundle.slug}`}
                  imageUrl={item!.bundle.featured_image_url}
                  shortDescription={item!.bundle.short_description}
                  productPreview={item!.includedProducts.slice(0, 3).map((product) => product.title)}
                  trustHighlights={[
                    "Bundle activo dentro de una campana visible.",
                    "Continuidad directa a bundle y compra.",
                    item!.snapshot && item!.snapshot.approved_products >= 3
                      ? "Seller con catalogo aprobado y actividad real."
                      : "Pack montado sobre productos aprobados del marketplace.",
                  ]}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.9rem] border border-white/10 bg-white/5 px-6 py-12 text-center text-[var(--text-soft)]">
              No hay bundles con deals activos ahora mismo.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
