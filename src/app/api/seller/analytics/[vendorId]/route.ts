import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{
    vendorId: string;
  }>;
}

const RANGE_OPTIONS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
} as const;

interface VendorRow {
  id: string;
  user_id: string;
  store_name: string;
}

interface ProductRow {
  id: string;
  title: string;
  slug: string;
  moderation_status: string;
  download_count: number;
  purchase_count: number;
  rating_average: number;
  rating_count: number;
  updated_at: string;
}

interface ProductAnalyticsDailyRow {
  product_id: string;
  day: string;
  view_count: number;
  click_count: number;
  add_to_cart_count: number;
  purchase_count: number;
  download_count: number;
  revenue_cents: number;
}

interface CouponRow {
  product_id: string;
  is_active: boolean;
  ends_at: string | null;
}

interface CampaignRow {
  product_id: string | null;
  campaign_type: "flash_deal" | "launch_discount" | "featured_placement";
  is_active: boolean;
  ends_at: string | null;
}

interface SellerReputationSnapshotRow {
  vendor_id: string;
  reputation_score: number;
}

interface SellerRiskSnapshotRow {
  vendor_id: string;
  risk_score: number;
  open_dispute_count: number;
  open_risk_event_count: number;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { vendorId } = await params;
  const rangeParam = request.nextUrl.searchParams.get("range") || "30d";
  const selectedRange =
    rangeParam in RANGE_OPTIONS ? (rangeParam as keyof typeof RANGE_OPTIONS) : "30d";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const adminSupabase = createAdminClient();
  const { data: vendorData } = (await adminSupabase
    .from("vendors")
    .select("id, user_id, store_name")
    .eq("id", vendorId)
    .maybeSingle()) as { data: VendorRow | null };

  const vendor = vendorData;

  if (!vendor) {
    return NextResponse.json({ message: "Vendor no encontrado" }, { status: 404 });
  }

  const isAdmin = profile?.role === "admin";
  const isOwner = vendor.user_id === user.id;

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
  }

  const since = new Date();
  since.setDate(since.getDate() - RANGE_OPTIONS[selectedRange]);

  const { data: products } = (await adminSupabase
    .from("products")
    .select(
      "id, title, slug, moderation_status, download_count, purchase_count, rating_average, rating_count, updated_at"
    )
    .eq("vendor_id", vendorId)
    .order("updated_at", { ascending: false })) as { data: ProductRow[] | null };

  const productRows = products || [];
  const productIds = productRows.map((product) => product.id);

  if (productIds.length === 0) {
    return NextResponse.json({
      range: selectedRange,
      summary: {
        products: 0,
        views: 0,
        clicks: 0,
        addToCarts: 0,
        purchases: 0,
        downloads: 0,
        revenueCents: 0,
        conversionRate: 0,
        activeCoupons: 0,
        activeCampaigns: 0,
      },
      products: [],
    });
  }

  const [
    { data: analyticsDaily },
    { data: coupons },
    { data: campaigns },
    { data: sellerReputationSnapshot },
    { data: sellerRiskSnapshot },
  ] =
    (await Promise.all([
      adminSupabase
        .from("product_analytics_daily")
        .select(
          "product_id, day, view_count, click_count, add_to_cart_count, purchase_count, download_count, revenue_cents"
        )
        .in("product_id", productIds)
        .gte("day", since.toISOString().slice(0, 10)),
      adminSupabase
        .from("coupons")
        .select("product_id, is_active, ends_at")
        .in("product_id", productIds)
        .eq("is_active", true),
      adminSupabase
        .from("campaigns")
        .select("product_id, campaign_type, is_active, ends_at")
        .in("product_id", productIds)
        .eq("is_active", true),
      adminSupabase
        .from("seller_reputation_snapshots")
        .select("vendor_id, reputation_score")
        .eq("vendor_id", vendorId)
        .maybeSingle(),
      adminSupabase
        .from("seller_risk_snapshots")
        .select("vendor_id, risk_score, open_dispute_count, open_risk_event_count")
        .eq("vendor_id", vendorId)
        .maybeSingle(),
    ])) as [
      { data: ProductAnalyticsDailyRow[] | null },
      { data: CouponRow[] | null },
      { data: CampaignRow[] | null },
      { data: SellerReputationSnapshotRow | null },
      { data: SellerRiskSnapshotRow | null },
    ];

  const analyticsRows = analyticsDaily || [];
  const couponRows = coupons || [];
  const campaignRows = campaigns || [];

  const eventMap = new Map<
    string,
    {
      views: number;
      clicks: number;
      addToCarts: number;
      purchases: number;
      downloads: number;
      revenueCents: number;
    }
  >();

  for (const analytics of analyticsRows) {
    const current = eventMap.get(analytics.product_id) || {
      views: 0,
      clicks: 0,
      addToCarts: 0,
      purchases: 0,
      downloads: 0,
      revenueCents: 0,
    };
    current.views += analytics.view_count || 0;
    current.clicks += analytics.click_count || 0;
    current.addToCarts += analytics.add_to_cart_count || 0;
    current.purchases += analytics.purchase_count || 0;
    current.downloads += analytics.download_count || 0;
    current.revenueCents += analytics.revenue_cents || 0;
    eventMap.set(analytics.product_id, current);
  }

  const couponMap = new Map<string, number>();
  const campaignMap = new Map<string, number>();
  const now = new Date().toISOString();
  for (const coupon of couponRows) {
    if (coupon.ends_at && coupon.ends_at < now) {
      continue;
    }
    couponMap.set(coupon.product_id, (couponMap.get(coupon.product_id) || 0) + 1);
  }

  for (const campaign of campaignRows) {
    if (!campaign.product_id) {
      continue;
    }

    if (campaign.ends_at && campaign.ends_at < now) {
      continue;
    }

    campaignMap.set(campaign.product_id, (campaignMap.get(campaign.product_id) || 0) + 1);
  }

  const analyticsProducts = productRows.map((product) => {
    const eventData = eventMap.get(product.id) || {
      views: 0,
      clicks: 0,
      addToCarts: 0,
      purchases: 0,
      downloads: 0,
      revenueCents: 0,
    };
    const activeCoupons = couponMap.get(product.id) || 0;
    const activeCampaigns = campaignMap.get(product.id) || 0;
    const conversionRate =
      eventData.views > 0 ? (eventData.purchases / eventData.views) * 100 : 0;

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      moderationStatus: product.moderation_status,
      views: eventData.views,
      clicks: eventData.clicks,
      addToCarts: eventData.addToCarts,
      purchases: eventData.purchases,
      downloads: eventData.downloads,
      revenueCents: eventData.revenueCents,
      conversionRate,
      ratingAverage: product.rating_average,
      ratingCount: product.rating_count,
      activeCoupons,
      activeCampaigns,
      updatedAt: product.updated_at,
    };
  });

  const summary = analyticsProducts.reduce(
    (accumulator, product) => {
      accumulator.products += 1;
      accumulator.views += product.views;
      accumulator.clicks += product.clicks;
      accumulator.addToCarts += product.addToCarts;
      accumulator.purchases += product.purchases;
      accumulator.downloads += product.downloads;
      accumulator.revenueCents += product.revenueCents;
      accumulator.activeCoupons += product.activeCoupons;
      accumulator.activeCampaigns += product.activeCampaigns;
      return accumulator;
    },
    {
      products: 0,
      views: 0,
      clicks: 0,
      addToCarts: 0,
      purchases: 0,
      downloads: 0,
      revenueCents: 0,
      activeCoupons: 0,
      activeCampaigns: 0,
    }
  );

  return NextResponse.json({
    range: selectedRange,
    vendor: {
      id: vendor.id,
      storeName: vendor.store_name,
    },
    sellerHealth: {
      reputationScore: sellerReputationSnapshot?.reputation_score || 0,
      riskScore: sellerRiskSnapshot?.risk_score || 0,
      healthScore: Math.max(
        0,
        Math.min(
          100,
          (sellerReputationSnapshot?.reputation_score || 0) -
            Math.floor((sellerRiskSnapshot?.risk_score || 0) * 0.7)
        )
      ),
      openDisputes: sellerRiskSnapshot?.open_dispute_count || 0,
      openRiskEvents: sellerRiskSnapshot?.open_risk_event_count || 0,
    },
    summary: {
      ...summary,
      conversionRate: summary.views > 0 ? (summary.purchases / summary.views) * 100 : 0,
    },
    products: analyticsProducts.sort(
      (a, b) =>
        b.revenueCents - a.revenueCents ||
        b.purchases - a.purchases ||
        b.views - a.views ||
        a.title.localeCompare(b.title)
    ),
  });
}
