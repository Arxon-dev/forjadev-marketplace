import type { Database } from "@/types/database";

type SupabaseClientLike = {
  from: (table: string) => any;
};

type VendorRow = Database["public"]["Tables"]["vendors"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type SellerSnapshotRow = Database["public"]["Tables"]["seller_reputation_snapshots"]["Row"];
type SellerBadgeRow = Database["public"]["Tables"]["seller_badges"]["Row"];

export type SellerBadge = {
  label: string;
  tone: "primary" | "success" | "warning";
};

export type SellerIdentityProvider = "discord" | "steam";

export type PublicSellerProfile = {
  vendor: VendorRow;
  products: ProductRow[];
  metrics: {
    approvedProducts: number;
    freeProducts: number;
    paidProducts: number;
    totalDownloads: number;
    totalPurchases: number;
    totalRatings: number;
    averageRating: number | null;
    joinedAt: string;
    latestProductUpdateAt: string | null;
    reputationScore: number;
  };
  identityVerification: {
    isVerified: boolean;
    providers: SellerIdentityProvider[];
  };
  badges: SellerBadge[];
};

function roundRating(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

export function deriveSellerBadges(
  metrics: PublicSellerProfile["metrics"],
  providers: SellerIdentityProvider[] = []
): SellerBadge[] {
  const badges: SellerBadge[] = [
    {
      label: "Tienda activa",
      tone: "primary",
    },
  ];

  if (providers.length > 0) {
    badges.push({
      label: "Identidad verificada",
      tone: "primary",
    });
  }

  if (metrics.totalPurchases >= 25) {
    badges.push({
      label: "Top seller",
      tone: "success",
    });
  }

  if ((metrics.averageRating || 0) >= 4.5 && metrics.totalRatings >= 5) {
    badges.push({
      label: "Muy bien valorado",
      tone: "success",
    });
  }

  if (
    metrics.latestProductUpdateAt &&
    Date.now() - new Date(metrics.latestProductUpdateAt).getTime() <= 1000 * 60 * 60 * 24 * 45
  ) {
    badges.push({
      label: "Mantenimiento activo",
      tone: "warning",
    });
  }

  return badges;
}

export async function getPublicSellerProfile(
  supabase: SupabaseClientLike,
  adminSupabase: SupabaseClientLike,
  slug: string
): Promise<PublicSellerProfile | null> {
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, user_id, store_name, slug, bio, discord_url, steam_url, x_url, website_url, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!vendor) {
    return null;
  }

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, vendor_id, category_id, game_id, title, slug, short_description, description, price_cents, currency, is_free, featured, search_text, view_count, download_count, purchase_count, rating_average, rating_count, moderation_status, rejection_reason, compatibility, featured_image_url, created_at, updated_at"
    )
    .eq("vendor_id", vendor.id)
    .eq("moderation_status", "approved")
    .order("featured", { ascending: false })
    .order("purchase_count", { ascending: false })
    .order("updated_at", { ascending: false });

  const approvedProducts = (products || []) as ProductRow[];
  const [snapshotResult, badgesResult, identityResult] = await Promise.all([
    supabase
      .from("seller_reputation_snapshots")
      .select(
        "vendor_id, approved_products, free_products, paid_products, total_downloads, total_purchases, total_ratings, average_rating, joined_at, latest_product_update_at, reputation_score, updated_at"
      )
      .eq("vendor_id", vendor.id)
      .maybeSingle(),
    supabase
      .from("seller_badges")
      .select("id, vendor_id, code, label, tone, sort_order, created_at")
      .eq("vendor_id", vendor.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    adminSupabase
      .from("user_provider_identities")
      .select("provider")
      .eq("user_id", vendor.user_id),
  ]);
  const totalRatings = approvedProducts.reduce((sum, product) => sum + product.rating_count, 0);
  const totalWeightedRating = approvedProducts.reduce(
    (sum, product) => sum + product.rating_average * product.rating_count,
    0
  );
  const latestProductUpdateAt =
    approvedProducts
      .map((product) => product.updated_at)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

  const snapshot = (snapshotResult.data || null) as SellerSnapshotRow | null;
  const metrics: PublicSellerProfile["metrics"] = snapshot
    ? {
        approvedProducts: snapshot.approved_products,
        freeProducts: snapshot.free_products,
        paidProducts: snapshot.paid_products,
        totalDownloads: snapshot.total_downloads,
        totalPurchases: snapshot.total_purchases,
        totalRatings: snapshot.total_ratings,
        averageRating: roundRating(snapshot.average_rating),
        joinedAt: snapshot.joined_at,
        latestProductUpdateAt: snapshot.latest_product_update_at,
        reputationScore: snapshot.reputation_score,
      }
    : {
        approvedProducts: approvedProducts.length,
        freeProducts: approvedProducts.filter((product) => product.is_free).length,
        paidProducts: approvedProducts.filter((product) => !product.is_free).length,
        totalDownloads: approvedProducts.reduce((sum, product) => sum + product.download_count, 0),
        totalPurchases: approvedProducts.reduce((sum, product) => sum + product.purchase_count, 0),
        totalRatings,
        averageRating: totalRatings > 0 ? roundRating(totalWeightedRating / totalRatings) : null,
        joinedAt: vendor.created_at,
        latestProductUpdateAt,
        reputationScore: Math.min(
          100,
          approvedProducts.length * 6 +
            Math.floor(
              approvedProducts.reduce((sum, product) => sum + product.purchase_count, 0) / 5
            ) +
            Math.floor(
              approvedProducts.reduce((sum, product) => sum + product.download_count, 0) / 20
            )
        ),
      };

  const persistedBadges = ((badgesResult.data || []) as SellerBadgeRow[]).map((badge) => ({
    label: badge.label,
    tone: badge.tone,
  }));
  const identityProviders = Array.from(
    new Set(
      (((identityResult.data || []) as Array<{ provider: SellerIdentityProvider }>).map(
        (identity) => identity.provider
      ) || []) as SellerIdentityProvider[]
    )
  );
  const derivedBadges = deriveSellerBadges(metrics, identityProviders);
  const finalBadges =
    persistedBadges.length > 0
      ? [
          ...persistedBadges,
          ...derivedBadges.filter(
            (badge) => !persistedBadges.some((persisted) => persisted.label === badge.label)
          ),
        ]
      : derivedBadges;

  return {
    vendor: vendor as VendorRow,
    products: approvedProducts,
    metrics,
    identityVerification: {
      isVerified: identityProviders.length > 0,
      providers: identityProviders,
    },
    badges: finalBadges,
  };
}
