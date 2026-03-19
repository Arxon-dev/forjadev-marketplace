import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeQualityTrustScore,
  type ProductRankingSnapshot,
  type SellerRankingSnapshot,
} from "@/lib/intelligence/catalog";

export interface RecommendedProductRow {
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
  purchase_count: number;
  download_count: number;
  updated_at: string;
  game_id?: string | null;
  intelligenceScore?: number;
}

export interface PersonalizedRecommendationRow extends RecommendedProductRow {
  author: string;
  categoryName: string;
  recommendationReason: string;
}

export interface RecommendedBundleRow {
  id: string;
  vendor_id: string;
  title: string;
  slug: string;
  short_description: string | null;
  featured_image_url: string | null;
  price_cents: number;
  author: string;
  includedProductCount: number;
  recommendationReason: string;
  intelligenceScore: number;
}

function computeSimilarityScore(
  product: RecommendedProductRow,
  current: {
    id: string;
    categoryId: string | null;
    gameId: string | null;
  },
  sellerReputationScore: number,
  sellerRiskScore: number
) {
  let score = 0;

  if (current.categoryId && product.category_id === current.categoryId) {
    score += 35;
  }

  if (current.gameId && product.game_id === current.gameId) {
    score += 25;
  }

  score += Math.min(15, Math.floor(product.purchase_count / 3));
  score += Math.min(10, Math.floor(product.download_count / 10));
  score += Math.round(product.rating_average * 4);
  score += Math.floor(sellerReputationScore / 10);
  score -= Math.floor(sellerRiskScore / 12);

  return score;
}

function daysSince(dateIso: string) {
  return Math.max(0, (Date.now() - new Date(dateIso).getTime()) / (1000 * 60 * 60 * 24));
}

function buildRecommendationReason(
  product: RecommendedProductRow,
  followedVendorIds: Set<string>,
  categoryInterestCounts: Map<string, number>,
  gameInterestCounts: Map<string, number>
) {
  if (followedVendorIds.has(product.vendor_id)) {
    return "Seller que sigues";
  }

  if (product.game_id && (gameInterestCounts.get(product.game_id) || 0) > 0) {
    return "Relacionado con tu actividad reciente";
  }

  if (product.category_id && (categoryInterestCounts.get(product.category_id) || 0) > 0) {
    return "Encaja con tu wishlist";
  }

  if (product.rating_count > 0 || product.purchase_count > 0) {
    return "Recomendado por calidad y trust";
  }

  return "Descubrimiento sugerido";
}

export async function getUsersAlsoBoughtProducts(productId: string, limit = 3) {
  const adminSupabase = createAdminClient();

  const { data: sourcePurchases } = await adminSupabase
    .from("order_items")
    .select("order:orders!inner(user_id, status)")
    .eq("product_id", productId)
    .eq("order.status", "completed");

  const userIds = Array.from(
    new Set(
      ((sourcePurchases || []) as Array<{ order: { user_id: string } | { user_id: string }[] }>)
        .flatMap((entry) => (Array.isArray(entry.order) ? entry.order : [entry.order]))
        .map((order) => order.user_id)
        .filter(Boolean)
    )
  );

  if (userIds.length === 0) {
    return [] as RecommendedProductRow[];
  }

  const { data: candidatePurchases } = await adminSupabase
    .from("order_items")
    .select(
      "product_id, order:orders!inner(user_id, status)"
    )
    .in("order.user_id", userIds)
    .eq("order.status", "completed")
    .neq("product_id", productId);

  const productCounts = new Map<string, number>();
  ((candidatePurchases || []) as Array<{ product_id: string }>).forEach((entry) => {
    productCounts.set(entry.product_id, (productCounts.get(entry.product_id) || 0) + 1);
  });

  const rankedIds = [...productCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(limit * 3, limit))
    .map(([candidateProductId]) => candidateProductId);

  if (rankedIds.length === 0) {
    return [] as RecommendedProductRow[];
  }

  const { data: products } = await adminSupabase
    .from("products")
    .select(
      "id, vendor_id, category_id, game_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count, purchase_count, download_count, updated_at"
    )
    .in("id", rankedIds)
    .eq("moderation_status", "approved");

  const productById = new Map(((products || []) as RecommendedProductRow[]).map((product) => [product.id, product]));

  return rankedIds
    .map((candidateId) => productById.get(candidateId))
    .filter((product): product is RecommendedProductRow => Boolean(product))
    .slice(0, limit);
}

export async function getSimilarProducts(
  current: {
    id: string;
    categoryId: string | null;
    gameId: string | null;
  },
  limit = 3
) {
  const adminSupabase = createAdminClient();

  if (!current.categoryId && !current.gameId) {
    return [] as RecommendedProductRow[];
  }

  const orFilters = [
    current.categoryId ? `category_id.eq.${current.categoryId}` : null,
    current.gameId ? `game_id.eq.${current.gameId}` : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data: products } = await adminSupabase
    .from("products")
    .select(
      "id, vendor_id, category_id, game_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count, purchase_count, download_count, updated_at"
    )
    .eq("moderation_status", "approved")
    .neq("id", current.id)
    .or(orFilters)
    .limit(Math.max(limit * 4, 12));

  const candidates = (products || []) as RecommendedProductRow[];

  if (candidates.length === 0) {
    return [];
  }

  const vendorIds = Array.from(new Set(candidates.map((product) => product.vendor_id)));
  const [sellerReputationResult, sellerRiskResult] = await Promise.all([
    vendorIds.length > 0
      ? adminSupabase
          .from("seller_reputation_snapshots")
          .select("vendor_id, reputation_score")
          .in("vendor_id", vendorIds)
      : Promise.resolve({ data: [] as Array<{ vendor_id: string; reputation_score: number }> }),
    vendorIds.length > 0
      ? adminSupabase
          .from("seller_risk_snapshots")
          .select("vendor_id, risk_score")
          .in("vendor_id", vendorIds)
      : Promise.resolve({ data: [] as Array<{ vendor_id: string; risk_score: number }> }),
  ]);

  const sellerReputationByVendorId = new Map(
    ((sellerReputationResult.data || []) as Array<{ vendor_id: string; reputation_score: number }>).map((item) => [item.vendor_id, item.reputation_score])
  );
  const sellerRiskByVendorId = new Map(
    ((sellerRiskResult.data || []) as Array<{ vendor_id: string; risk_score: number }>).map((item) => [item.vendor_id, item.risk_score])
  );

  return [...candidates]
    .map((product) => ({
      ...product,
      intelligenceScore: computeSimilarityScore(
        product,
        current,
        sellerReputationByVendorId.get(product.vendor_id) || 0,
        sellerRiskByVendorId.get(product.vendor_id) || 0
      ),
    }))
    .sort((a, b) => {
      return (
        (b.intelligenceScore || 0) - (a.intelligenceScore || 0) ||
        b.purchase_count - a.purchase_count ||
        b.rating_average - a.rating_average ||
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    })
    .slice(0, limit);
}

export async function getPersonalizedRecommendations(userId: string, limit = 6) {
  const adminSupabase = createAdminClient();
  const discoveryLimit = Math.max(limit * 6, 24);

  const [wishlistResult, followedSellerResult, downloadsResult, purchasesResult] =
    await Promise.all([
      adminSupabase.from("wishlists").select("product_id").eq("user_id", userId),
      adminSupabase.from("seller_followers").select("vendor_id").eq("user_id", userId),
      adminSupabase.from("downloads").select("product_id").eq("user_id", userId),
      adminSupabase
        .from("order_items")
        .select("product_id, order:orders!inner(user_id, status)")
        .eq("order.user_id", userId)
        .eq("order.status", "completed"),
    ]);

  const wishlistProductIds = new Set(
    ((wishlistResult.data || []) as Array<{ product_id: string }>).map((row) => row.product_id)
  );
  const followedVendorIds = new Set(
    ((followedSellerResult.data || []) as Array<{ vendor_id: string }>).map((row) => row.vendor_id)
  );
  const downloadedProductIds = new Set(
    ((downloadsResult.data || []) as Array<{ product_id: string }>).map((row) => row.product_id)
  );
  const purchasedProductIds = new Set(
    (
      (purchasesResult.data || []) as Array<{
        product_id: string;
        order: { user_id: string; status: string } | { user_id: string; status: string }[];
      }>
    ).map((row) => row.product_id)
  );

  const seedProductIds = Array.from(
    new Set([
      ...wishlistProductIds,
      ...downloadedProductIds,
      ...purchasedProductIds,
    ])
  );

  const seedProductsResult =
    seedProductIds.length > 0
      ? await adminSupabase
          .from("products")
          .select(
            "id, vendor_id, category_id, game_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count, purchase_count, download_count, updated_at"
          )
          .in("id", seedProductIds)
      : { data: [] as RecommendedProductRow[] };

  const seedProducts = (seedProductsResult.data || []) as RecommendedProductRow[];
  const categoryInterestCounts = new Map<string, number>();
  const gameInterestCounts = new Map<string, number>();
  const vendorInterestCounts = new Map<string, number>();

  for (const product of seedProducts) {
    vendorInterestCounts.set(
      product.vendor_id,
      (vendorInterestCounts.get(product.vendor_id) || 0) + 1
    );

    if (product.category_id) {
      categoryInterestCounts.set(
        product.category_id,
        (categoryInterestCounts.get(product.category_id) || 0) + 1
      );
    }

    if (product.game_id) {
      gameInterestCounts.set(
        product.game_id,
        (gameInterestCounts.get(product.game_id) || 0) + 1
      );
    }
  }

  const categoryIds = Array.from(categoryInterestCounts.keys());
  const gameIds = Array.from(gameInterestCounts.keys());

  const [followedVendorProductsResult, categoryProductsResult, gameProductsResult, fallbackProductsResult] =
    await Promise.all([
      followedVendorIds.size > 0
        ? adminSupabase
            .from("products")
            .select(
              "id, vendor_id, category_id, game_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count, purchase_count, download_count, updated_at, featured"
            )
            .in("vendor_id", Array.from(followedVendorIds))
            .eq("moderation_status", "approved")
            .order("updated_at", { ascending: false })
            .limit(discoveryLimit)
        : Promise.resolve({ data: [] as RecommendedProductRow[] }),
      categoryIds.length > 0
        ? adminSupabase
            .from("products")
            .select(
              "id, vendor_id, category_id, game_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count, purchase_count, download_count, updated_at, featured"
            )
            .in("category_id", categoryIds)
            .eq("moderation_status", "approved")
            .order("purchase_count", { ascending: false })
            .order("rating_average", { ascending: false })
            .limit(discoveryLimit)
        : Promise.resolve({ data: [] as RecommendedProductRow[] }),
      gameIds.length > 0
        ? adminSupabase
            .from("products")
            .select(
              "id, vendor_id, category_id, game_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count, purchase_count, download_count, updated_at, featured"
            )
            .in("game_id", gameIds)
            .eq("moderation_status", "approved")
            .order("purchase_count", { ascending: false })
            .order("rating_average", { ascending: false })
            .limit(discoveryLimit)
        : Promise.resolve({ data: [] as RecommendedProductRow[] }),
      adminSupabase
        .from("products")
        .select(
          "id, vendor_id, category_id, game_id, title, slug, price_cents, is_free, compatibility, featured_image_url, rating_average, rating_count, purchase_count, download_count, updated_at, featured"
        )
        .eq("moderation_status", "approved")
        .order("featured", { ascending: false })
        .order("rating_average", { ascending: false })
        .order("purchase_count", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(discoveryLimit),
    ]);

  const candidateById = new Map<string, RecommendedProductRow>();

  for (const candidate of [
    ...((followedVendorProductsResult.data || []) as RecommendedProductRow[]),
    ...((categoryProductsResult.data || []) as RecommendedProductRow[]),
    ...((gameProductsResult.data || []) as RecommendedProductRow[]),
    ...((fallbackProductsResult.data || []) as RecommendedProductRow[]),
  ]) {
    if (seedProductIds.includes(candidate.id)) {
      continue;
    }

    candidateById.set(candidate.id, candidate);
  }

  const candidates = Array.from(candidateById.values());
  if (candidates.length === 0) {
    return [] as PersonalizedRecommendationRow[];
  }

  const vendorIds = Array.from(new Set(candidates.map((product) => product.vendor_id)));
  const candidateProductIds = candidates.map((product) => product.id);
  const categoryIdsForLookup = Array.from(
    new Set(candidates.map((product) => product.category_id).filter(Boolean))
  ) as string[];

  const [vendorResult, categoryResult, sellerReputationResult, sellerRiskResult, productRiskResult] =
    await Promise.all([
      vendorIds.length > 0
        ? adminSupabase.from("vendors").select("id, store_name").in("id", vendorIds)
        : Promise.resolve({ data: [] as Array<{ id: string; store_name: string }> }),
      categoryIdsForLookup.length > 0
        ? adminSupabase.from("categories").select("id, name").in("id", categoryIdsForLookup)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      vendorIds.length > 0
        ? adminSupabase
            .from("seller_reputation_snapshots")
            .select("vendor_id, reputation_score")
            .in("vendor_id", vendorIds)
        : Promise.resolve({ data: [] as Array<{ vendor_id: string; reputation_score: number }> }),
      vendorIds.length > 0
        ? adminSupabase
            .from("seller_risk_snapshots")
            .select("vendor_id, risk_score")
            .in("vendor_id", vendorIds)
        : Promise.resolve({ data: [] as Array<{ vendor_id: string; risk_score: number }> }),
      candidateProductIds.length > 0
        ? adminSupabase
            .from("product_risk_snapshots")
            .select("product_id, risk_score")
            .in("product_id", candidateProductIds)
        : Promise.resolve({ data: [] as Array<{ product_id: string; risk_score: number }> }),
    ]);

  const vendorById = new Map(
    ((vendorResult.data || []) as Array<{ id: string; store_name: string }>).map((vendor) => [
      vendor.id,
      vendor.store_name,
    ])
  );
  const categoryById = new Map(
    ((categoryResult.data || []) as Array<{ id: string; name: string }>).map((category) => [
      category.id,
      category.name,
    ])
  );
  const sellerReputationByVendorId = new Map(
    ((sellerReputationResult.data || []) as Array<{ vendor_id: string; reputation_score: number }>).map(
      (item) => [item.vendor_id, item.reputation_score]
    )
  );
  const sellerRiskByVendorId = new Map(
    ((sellerRiskResult.data || []) as Array<{ vendor_id: string; risk_score: number }>).map(
      (item) => [item.vendor_id, item.risk_score]
    )
  );
  const productRiskById = new Map(
    ((productRiskResult.data || []) as Array<{ product_id: string; risk_score: number }>).map(
      (item) => [item.product_id, item.risk_score]
    )
  );

  return [...candidates]
    .map((product) => {
      const sellerSnapshot: SellerRankingSnapshot = {
        reputationScore: sellerReputationByVendorId.get(product.vendor_id) || 0,
        riskScore: sellerRiskByVendorId.get(product.vendor_id) || 0,
      };
      const productSnapshot: ProductRankingSnapshot = {
        riskScore: productRiskById.get(product.id) || 0,
      };
      const baseScore = computeQualityTrustScore(
        {
          id: product.id,
          vendor_id: product.vendor_id,
          featured: false,
          rating_average: product.rating_average,
          rating_count: product.rating_count,
          download_count: product.download_count,
          purchase_count: product.purchase_count,
          created_at: product.updated_at,
          updated_at: product.updated_at,
        },
        sellerSnapshot,
        productSnapshot
      );
      const categoryAffinity =
        product.category_id && categoryInterestCounts.has(product.category_id)
          ? Math.min(18, (categoryInterestCounts.get(product.category_id) || 0) * 8)
          : 0;
      const gameAffinity =
        product.game_id && gameInterestCounts.has(product.game_id)
          ? Math.min(20, (gameInterestCounts.get(product.game_id) || 0) * 10)
          : 0;
      const followedSellerBoost = followedVendorIds.has(product.vendor_id) ? 24 : 0;
      const vendorAffinity = Math.min(12, (vendorInterestCounts.get(product.vendor_id) || 0) * 6);
      const freshnessBonus = Math.max(0, 6 - Math.floor(daysSince(product.updated_at) / 21));

      return {
        ...product,
        author: vendorById.get(product.vendor_id) || "ForjaDev",
        categoryName: categoryById.get(product.category_id || "") || "Marketplace",
        recommendationReason: buildRecommendationReason(
          product,
          followedVendorIds,
          categoryInterestCounts,
          gameInterestCounts
        ),
        intelligenceScore:
          baseScore +
          categoryAffinity +
          gameAffinity +
          followedSellerBoost +
          vendorAffinity +
          freshnessBonus,
      };
    })
    .sort((a, b) => {
      return (
        (b.intelligenceScore || 0) - (a.intelligenceScore || 0) ||
        b.purchase_count - a.purchase_count ||
        b.rating_average - a.rating_average ||
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    })
    .slice(0, limit);
}

export async function getRecommendedBundles(userId: string, limit = 3) {
  const adminSupabase = createAdminClient();

  const [followedSellerResult, wishlistResult, downloadsResult, purchasesResult] =
    await Promise.all([
      adminSupabase.from("seller_followers").select("vendor_id").eq("user_id", userId),
      adminSupabase.from("wishlists").select("product_id").eq("user_id", userId),
      adminSupabase.from("downloads").select("product_id").eq("user_id", userId),
      adminSupabase
        .from("order_items")
        .select("product_id, order:orders!inner(user_id, status)")
        .eq("order.user_id", userId)
        .eq("order.status", "completed"),
    ]);

  const followedVendorIds = new Set(
    ((followedSellerResult.data || []) as Array<{ vendor_id: string }>).map((row) => row.vendor_id)
  );
  const interestProductIds = Array.from(
    new Set([
      ...((wishlistResult.data || []) as Array<{ product_id: string }>).map((row) => row.product_id),
      ...((downloadsResult.data || []) as Array<{ product_id: string }>).map((row) => row.product_id),
      ...((purchasesResult.data || []) as Array<{ product_id: string }>).map((row) => row.product_id),
    ])
  );

  const [candidateBundlesResult, bundleItemsResult] = await Promise.all([
    adminSupabase
      .from("bundles")
      .select("id, vendor_id, title, slug, short_description, featured_image_url, price_cents")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(Math.max(limit * 8, 24)),
    adminSupabase
      .from("bundle_products")
      .select("bundle_id, product_id")
      .limit(500),
  ]);

  const candidateBundles = (candidateBundlesResult.data || []) as Array<{
    id: string;
    vendor_id: string;
    title: string;
    slug: string;
    short_description: string | null;
    featured_image_url: string | null;
    price_cents: number;
  }>;
  const bundleItems = (bundleItemsResult.data || []) as Array<{ bundle_id: string; product_id: string }>;

  if (candidateBundles.length === 0 || bundleItems.length === 0) {
    return [] as RecommendedBundleRow[];
  }

  const productIdsInBundles = Array.from(new Set(bundleItems.map((item) => item.product_id)));
  const [vendorResult, productResult, interestProductsResult, sellerReputationResult, sellerRiskResult] = await Promise.all([
    adminSupabase
      .from("vendors")
      .select("id, store_name")
      .in("id", Array.from(new Set(candidateBundles.map((bundle) => bundle.vendor_id)))),
    productIdsInBundles.length > 0
      ? adminSupabase
          .from("products")
          .select("id, category_id, game_id, moderation_status")
          .in("id", productIdsInBundles)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            category_id: string | null;
            game_id: string | null;
            moderation_status: string;
          }>,
        }),
    interestProductIds.length > 0
      ? adminSupabase
          .from("products")
          .select("id, category_id, game_id")
          .in("id", interestProductIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            category_id: string | null;
            game_id: string | null;
          }>,
        }),
    candidateBundles.length > 0
      ? adminSupabase
          .from("seller_reputation_snapshots")
          .select("vendor_id, reputation_score")
          .in("vendor_id", Array.from(new Set(candidateBundles.map((bundle) => bundle.vendor_id))))
      : Promise.resolve({ data: [] as Array<{ vendor_id: string; reputation_score: number }> }),
    candidateBundles.length > 0
      ? adminSupabase
          .from("seller_risk_snapshots")
          .select("vendor_id, risk_score")
          .in("vendor_id", Array.from(new Set(candidateBundles.map((bundle) => bundle.vendor_id))))
      : Promise.resolve({ data: [] as Array<{ vendor_id: string; risk_score: number }> }),
  ]);

  const vendorById = new Map(
    ((vendorResult.data || []) as Array<{ id: string; store_name: string }>).map((vendor) => [
      vendor.id,
      vendor.store_name,
    ])
  );
  const productById = new Map(
    (
      (productResult.data || []) as Array<{
        id: string;
        category_id: string | null;
        game_id: string | null;
        moderation_status: string;
      }>
    ).map((product) => [product.id, product])
  );
  const interestProductsById = new Map(
    (
      (interestProductsResult.data || []) as Array<{
        id: string;
        category_id: string | null;
        game_id: string | null;
      }>
    ).map((product) => [product.id, product])
  );
  const sellerReputationByVendorId = new Map(
    ((sellerReputationResult.data || []) as Array<{ vendor_id: string; reputation_score: number }>).map(
      (item) => [item.vendor_id, item.reputation_score]
    )
  );
  const sellerRiskByVendorId = new Map(
    ((sellerRiskResult.data || []) as Array<{ vendor_id: string; risk_score: number }>).map(
      (item) => [item.vendor_id, item.risk_score]
    )
  );

  const bundleProductsByBundleId = new Map<string, string[]>();
  for (const item of bundleItems) {
    const product = productById.get(item.product_id);
    if (!product || product.moderation_status !== "approved") {
      continue;
    }

    const current = bundleProductsByBundleId.get(item.bundle_id) || [];
    current.push(item.product_id);
    bundleProductsByBundleId.set(item.bundle_id, current);
  }

  return candidateBundles
    .map((bundle) => {
      const bundleProductIds = bundleProductsByBundleId.get(bundle.id) || [];
      if (bundleProductIds.length === 0) {
        return null;
      }

      let matchedInterestProducts = 0;
      let matchedGames = 0;
      let matchedCategories = 0;

      for (const productId of bundleProductIds) {
        const product = productById.get(productId);
        if (!product) {
          continue;
        }

        if (interestProductIds.includes(productId)) {
          matchedInterestProducts += 1;
        }

        if (
          product.game_id &&
          interestProductIds.some(
            (interestId) => interestProductsById.get(interestId)?.game_id === product.game_id
          )
        ) {
          matchedGames += 1;
        }

        if (
          product.category_id &&
          interestProductIds.some(
            (interestId) =>
              interestProductsById.get(interestId)?.category_id === product.category_id
          )
        ) {
          matchedCategories += 1;
        }
      }

      const sellerFollowBoost = followedVendorIds.has(bundle.vendor_id) ? 28 : 0;
      const sellerReputationBoost = Math.min(
        18,
        Math.floor((sellerReputationByVendorId.get(bundle.vendor_id) || 0) / 6)
      );
      const sellerRiskPenalty = Math.min(
        20,
        Math.floor((sellerRiskByVendorId.get(bundle.vendor_id) || 0) / 5)
      );
      const intelligenceScore =
        matchedInterestProducts * 18 +
        matchedGames * 10 +
        matchedCategories * 8 +
        sellerFollowBoost +
        sellerReputationBoost -
        sellerRiskPenalty;

      const recommendationReason = followedVendorIds.has(bundle.vendor_id)
        ? "Bundle de un seller que sigues"
        : matchedInterestProducts > 0
          ? "Incluye productos muy cercanos a tu actividad"
          : matchedGames > 0 || matchedCategories > 0
            ? "Bundle alineado con tus intereses"
            : "Bundle recomendado por calidad del seller";

      return {
        ...bundle,
        author: vendorById.get(bundle.vendor_id) || "ForjaDev",
        includedProductCount: bundleProductIds.length,
        recommendationReason,
        intelligenceScore,
      } satisfies RecommendedBundleRow;
    })
    .filter((bundle): bundle is RecommendedBundleRow => Boolean(bundle))
    .sort((a, b) => b.intelligenceScore - a.intelligenceScore)
    .slice(0, limit);
}
