import { createOptionalAdminClient } from "@/lib/supabase/admin";
import { getPublicDealsForBundles } from "@/lib/promotions/public";

interface BundleRow {
  id: string;
  vendor_id: string;
  title: string;
  slug: string;
  short_description: string | null;
  featured_image_url: string | null;
  price_cents: number;
}

interface BundleProductRow {
  bundle_id: string;
  sort_order: number;
  product: {
    id: string;
    title: string;
    slug: string;
    price_cents: number;
    moderation_status: string;
  } | {
    id: string;
    title: string;
    slug: string;
    price_cents: number;
    moderation_status: string;
  }[] | null;
}

interface SellerSnapshotRow {
  vendor_id: string;
  approved_products: number;
  total_purchases: number;
}

function resolveBundleProduct(
  product: BundleProductRow["product"]
): { id: string; title: string; slug: string; price_cents: number; moderation_status: string } | null {
  return Array.isArray(product) ? (product[0] ?? null) : product;
}

export interface ProductCompositionBundle {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  featuredImageUrl: string | null;
  itemCount: number;
  includedProducts: Array<{ id: string; title: string; slug: string }>;
  checkoutPriceCents: number;
  originalTotalCents: number;
  savingsCents: number;
  promoLabel: string | null;
  sellerContext: string;
}

export async function getProductCompositionOptions(productId: string) {
  const adminSupabase = createOptionalAdminClient();
  if (!adminSupabase) {
    return [] as ProductCompositionBundle[];
  }

  const { data: bundleLinks } = await adminSupabase
    .from("bundle_products")
    .select("bundle_id")
    .eq("product_id", productId);

  const bundleIds = Array.from(
    new Set(((bundleLinks || []) as Array<{ bundle_id: string }>).map((row) => row.bundle_id))
  );

  if (bundleIds.length === 0) {
    return [] as ProductCompositionBundle[];
  }

  const [bundlesResult, bundleProductsResult] = await Promise.all([
    adminSupabase
      .from("bundles")
      .select("id, vendor_id, title, slug, short_description, featured_image_url, price_cents")
      .eq("is_active", true)
      .in("id", bundleIds),
    adminSupabase
      .from("bundle_products")
      .select(
        "bundle_id, sort_order, product:products!inner(id, title, slug, price_cents, moderation_status)"
      )
      .in("bundle_id", bundleIds)
      .order("sort_order", { ascending: true }),
  ]);

  const bundles = (bundlesResult.data || []) as BundleRow[];
  const vendorIds = Array.from(new Set(bundles.map((bundle) => bundle.vendor_id)));
  const { data: snapshotsData } = vendorIds.length
    ? await adminSupabase
        .from("seller_reputation_snapshots")
        .select("vendor_id, approved_products, total_purchases")
        .in("vendor_id", vendorIds)
    : { data: [] as SellerSnapshotRow[] };

  const snapshotByVendorId = new Map(
    ((snapshotsData || []) as SellerSnapshotRow[]).map((snapshot) => [snapshot.vendor_id, snapshot])
  );

  const bundleProductsById = ((bundleProductsResult.data || []) as BundleProductRow[]).reduce<
    Map<string, Array<{ id: string; title: string; slug: string; price_cents: number; moderation_status: string }>>
  >((map, row) => {
    const product = resolveBundleProduct(row.product);
    if (!product || product.moderation_status !== "approved") {
      return map;
    }

    const current = map.get(row.bundle_id) || [];
    current.push(product);
    map.set(row.bundle_id, current);
    return map;
  }, new Map());

  const dealsByBundleId = await getPublicDealsForBundles(
    bundles.map((bundle) => ({
      id: bundle.id,
      price_cents: bundle.price_cents,
    }))
  );

  return bundles
    .map((bundle) => {
      const includedProducts = bundleProductsById.get(bundle.id) || [];
      if (!includedProducts.some((product) => product.id === productId) || includedProducts.length <= 1) {
        return null;
      }

      const originalTotalCents = includedProducts.reduce((sum, product) => sum + product.price_cents, 0);
      const activeDeal = dealsByBundleId.get(bundle.id) || null;
      const checkoutPriceCents = activeDeal?.discountedPriceCents ?? bundle.price_cents;
      const savingsCents = Math.max(0, originalTotalCents - checkoutPriceCents);
      const snapshot = snapshotByVendorId.get(bundle.vendor_id);

      return {
        id: bundle.id,
        title: bundle.title,
        slug: bundle.slug,
        shortDescription: bundle.short_description,
        featuredImageUrl: bundle.featured_image_url,
        itemCount: includedProducts.length,
        includedProducts: includedProducts.map((product) => ({
          id: product.id,
          title: product.title,
          slug: product.slug,
        })),
        checkoutPriceCents,
        originalTotalCents,
        savingsCents,
        promoLabel: activeDeal?.promoLabel || null,
        sellerContext:
          snapshot && (snapshot.approved_products >= 3 || snapshot.total_purchases >= 25)
            ? "Seller con catalogo y compras ya consolidadas."
            : "Bundle activo construido sobre productos aprobados del marketplace.",
      } satisfies ProductCompositionBundle;
    })
    .filter(Boolean)
    .sort((left, right) => right!.savingsCents - left!.savingsCents || right!.itemCount - left!.itemCount)
    .slice(0, 3) as ProductCompositionBundle[];
}
