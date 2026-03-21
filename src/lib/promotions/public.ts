import { createOptionalAdminClient } from "@/lib/supabase/admin";

interface DealEligibleProduct {
  id: string;
  price_cents: number;
  is_free: boolean;
}

interface DealEligibleBundle {
  id: string;
  price_cents: number;
}

export interface PublicFeaturedPlacement {
  entityType: "product" | "bundle";
  entityId: string;
  title: string;
  expiresAt: string | null;
}

export interface PublicDeal {
  entityId: string;
  code: string | null;
  source: "coupon" | "campaign";
  campaignType: "flash_deal" | "launch_discount" | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  savingsCents: number;
  discountedPriceCents: number;
  expiresAt: string | null;
  promoLabel: string;
}

interface CouponRow {
  product_id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

interface CampaignRow {
  product_id: string | null;
  bundle_id: string | null;
  title: string;
  campaign_type: "flash_deal" | "launch_discount" | "featured_placement";
  discount_type: "percent" | "fixed" | null;
  discount_value: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
}

interface FeaturedPlacementCampaignRow {
  product_id: string | null;
  bundle_id: string | null;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

function calculateSavings(
  priceCents: number,
  discountType: "percent" | "fixed",
  discountValue: number
) {
  if (discountType === "percent") {
    return Math.floor(priceCents * Math.min(discountValue, 100) / 100);
  }

  return Math.min(priceCents, discountValue);
}

function isCurrentlyActive(startsAt: string | null, endsAt: string | null, nowIso: string) {
  if (startsAt && startsAt > nowIso) {
    return false;
  }

  if (endsAt && endsAt < nowIso) {
    return false;
  }

  return true;
}

function buildPromoLabel(params: {
  source: "coupon" | "campaign";
  campaignType: "flash_deal" | "launch_discount" | null;
  code: string | null;
  discountType: "percent" | "fixed";
  discountValue: number;
  savingsCents: number;
}) {
  if (params.source === "campaign") {
    if (params.discountType === "percent") {
      return params.campaignType === "launch_discount"
        ? `LANZAMIENTO | ${params.discountValue}% OFF`
        : `FLASH DEAL | ${params.discountValue}% OFF`;
    }

    return params.campaignType === "launch_discount"
      ? `LANZAMIENTO | EUR ${(params.savingsCents / 100).toFixed(2)} OFF`
      : `FLASH DEAL | EUR ${(params.savingsCents / 100).toFixed(2)} OFF`;
  }

  if (params.discountType === "percent") {
    return `${params.discountValue}% OFF | ${params.code}`;
  }

  return `DEAL | ${params.code}`;
}

export async function getPublicDealsForProducts(products: DealEligibleProduct[]) {
  const paidProducts = products.filter((product) => !product.is_free && product.price_cents > 0);
  if (paidProducts.length === 0) {
    return new Map<string, PublicDeal>();
  }

  const adminSupabase = createOptionalAdminClient();
  if (!adminSupabase) {
    return new Map<string, PublicDeal>();
  }
  const productIds = paidProducts.map((product) => product.id);
  const productById = new Map(paidProducts.map((product) => [product.id, product]));
  const nowIso = new Date().toISOString();

  const [{ data: coupons }, { data: campaigns }] = await Promise.all([
    adminSupabase
      .from("coupons")
      .select("product_id, code, discount_type, discount_value, starts_at, ends_at, is_active")
      .in("product_id", productIds)
      .eq("is_active", true),
    adminSupabase
      .from("campaigns")
      .select(
        "product_id, bundle_id, title, campaign_type, discount_type, discount_value, starts_at, ends_at, is_active"
      )
      .in("product_id", productIds)
      .eq("is_active", true),
  ]);

  const bestDealByProduct = new Map<string, PublicDeal>();

  for (const campaign of (campaigns || []) as CampaignRow[]) {
    if (!campaign.product_id) {
      continue;
    }

    if (!isCurrentlyActive(campaign.starts_at, campaign.ends_at, nowIso)) {
      continue;
    }

    if (
      !campaign.discount_type ||
      !campaign.discount_value ||
      campaign.campaign_type === "featured_placement"
    ) {
      continue;
    }

    const product = productById.get(campaign.product_id);
    if (!product) {
      continue;
    }

    const savingsCents = calculateSavings(
      product.price_cents,
      campaign.discount_type,
      campaign.discount_value
    );

    if (savingsCents <= 0) {
      continue;
    }

    const currentBest = bestDealByProduct.get(product.id);
    if (currentBest && currentBest.savingsCents >= savingsCents) {
      continue;
    }

    bestDealByProduct.set(product.id, {
      entityId: product.id,
      code: null,
      source: "campaign",
      campaignType: campaign.campaign_type,
      discountType: campaign.discount_type,
      discountValue: campaign.discount_value,
      savingsCents,
      discountedPriceCents: Math.max(0, product.price_cents - savingsCents),
      expiresAt: campaign.ends_at,
      promoLabel: buildPromoLabel({
        source: "campaign",
        campaignType: campaign.campaign_type,
        code: null,
        discountType: campaign.discount_type,
        discountValue: campaign.discount_value,
        savingsCents,
      }),
    });
  }

  for (const coupon of (coupons || []) as CouponRow[]) {
    if (!isCurrentlyActive(coupon.starts_at, coupon.ends_at, nowIso)) {
      continue;
    }

    const product = productById.get(coupon.product_id);
    if (!product) {
      continue;
    }

    const savingsCents = calculateSavings(
      product.price_cents,
      coupon.discount_type,
      coupon.discount_value
    );

    if (savingsCents <= 0) {
      continue;
    }

    const currentBest = bestDealByProduct.get(product.id);
    if (currentBest && currentBest.savingsCents >= savingsCents) {
      continue;
    }

    bestDealByProduct.set(product.id, {
      entityId: product.id,
      code: coupon.code,
      source: "coupon",
      campaignType: null,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      savingsCents,
      discountedPriceCents: Math.max(0, product.price_cents - savingsCents),
      expiresAt: coupon.ends_at,
      promoLabel: buildPromoLabel({
        source: "coupon",
        campaignType: null,
        code: coupon.code,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        savingsCents,
      }),
    });
  }

  return bestDealByProduct;
}

export async function getPublicDealsForBundles(bundles: DealEligibleBundle[]) {
  if (bundles.length === 0) {
    return new Map<string, PublicDeal>();
  }

  const adminSupabase = createOptionalAdminClient();
  if (!adminSupabase) {
    return new Map<string, PublicDeal>();
  }
  const bundleIds = bundles.map((bundle) => bundle.id);
  const bundleById = new Map(bundles.map((bundle) => [bundle.id, bundle]));
  const nowIso = new Date().toISOString();

  const { data: campaigns } = await adminSupabase
    .from("campaigns")
    .select(
      "product_id, bundle_id, title, campaign_type, discount_type, discount_value, starts_at, ends_at, is_active"
    )
    .in("bundle_id", bundleIds)
    .eq("is_active", true);

  const bestDealByBundle = new Map<string, PublicDeal>();

  for (const campaign of (campaigns || []) as CampaignRow[]) {
    if (!campaign.bundle_id) {
      continue;
    }

    if (!isCurrentlyActive(campaign.starts_at, campaign.ends_at, nowIso)) {
      continue;
    }

    if (
      !campaign.discount_type ||
      !campaign.discount_value ||
      campaign.campaign_type === "featured_placement"
    ) {
      continue;
    }

    const bundle = bundleById.get(campaign.bundle_id);
    if (!bundle) {
      continue;
    }

    const savingsCents = calculateSavings(
      bundle.price_cents,
      campaign.discount_type,
      campaign.discount_value
    );

    if (savingsCents <= 0) {
      continue;
    }

    const currentBest = bestDealByBundle.get(bundle.id);
    if (currentBest && currentBest.savingsCents >= savingsCents) {
      continue;
    }

    bestDealByBundle.set(bundle.id, {
      entityId: bundle.id,
      code: null,
      source: "campaign",
      campaignType: campaign.campaign_type,
      discountType: campaign.discount_type,
      discountValue: campaign.discount_value,
      savingsCents,
      discountedPriceCents: Math.max(0, bundle.price_cents - savingsCents),
      expiresAt: campaign.ends_at,
      promoLabel: buildPromoLabel({
        source: "campaign",
        campaignType: campaign.campaign_type,
        code: null,
        discountType: campaign.discount_type,
        discountValue: campaign.discount_value,
        savingsCents,
      }),
    });
  }

  return bestDealByBundle;
}

export async function getPublicFeaturedPlacements(limit = 6) {
  if (limit <= 0) {
    return [] as PublicFeaturedPlacement[];
  }

  const adminSupabase = createOptionalAdminClient();
  if (!adminSupabase) {
    return [] as PublicFeaturedPlacement[];
  }
  const nowIso = new Date().toISOString();

  const { data: campaigns } = await adminSupabase
    .from("campaigns")
    .select("title, product_id, bundle_id, campaign_type, starts_at, ends_at, is_active, created_at")
    .eq("campaign_type", "featured_placement")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  const placements: PublicFeaturedPlacement[] = [];
  const seen = new Set<string>();

  for (const campaign of (campaigns || []) as FeaturedPlacementCampaignRow[]) {
    if (!isCurrentlyActive(campaign.starts_at, campaign.ends_at, nowIso)) {
      continue;
    }

    const entityType = campaign.product_id ? "product" : campaign.bundle_id ? "bundle" : null;
    const entityId = campaign.product_id || campaign.bundle_id || null;

    if (!entityType || !entityId) {
      continue;
    }

    const dedupeKey = `${entityType}:${entityId}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    placements.push({
      entityType,
      entityId,
      title: campaign.title,
      expiresAt: campaign.ends_at,
    });

    if (placements.length === limit) {
      break;
    }
  }

  return placements;
}
