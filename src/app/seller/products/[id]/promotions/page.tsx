import { SiteHeaderServer } from "@/components/layout/site-header-server";
import {
  SellerProductPromotionsWorkspace,
  type SellerProductCampaignItem,
  type SellerProductCouponItem,
} from "@/components/seller/seller-product-promotions-workspace";
import { requireOwnedProductContext } from "@/lib/auth/seller";

interface ProductAnalyticsDailyRow {
  view_count: number;
  purchase_count: number;
  revenue_cents: number;
}

interface SellerProductPromotionsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SellerProductPromotionsPage({
  params,
}: SellerProductPromotionsPageProps) {
  const { id } = await params;
  const { supabase, product } = await requireOwnedProductContext(id);

  const [campaignsResult, couponsResult, analyticsResult, activeReleaseResult] = await Promise.all([
    supabase
      .from("campaigns")
      .select(
        "id, title, campaign_type, discount_type, discount_value, starts_at, ends_at, is_active, created_at, updated_at"
      )
      .eq("product_id", product.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("coupons")
      .select(
        "id, code, discount_type, discount_value, starts_at, ends_at, max_redemptions, redemption_count, is_active, created_at"
      )
      .eq("product_id", product.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("product_analytics_daily")
      .select("view_count, purchase_count, revenue_cents")
      .eq("product_id", product.id),
    supabase
      .from("product_versions")
      .select("version")
      .eq("product_id", product.id)
      .eq("release_status", "active")
      .maybeSingle(),
  ]);

  const analytics = ((analyticsResult.data || []) as ProductAnalyticsDailyRow[]).reduce(
    (accumulator, entry) => ({
      views: accumulator.views + entry.view_count,
      purchases: accumulator.purchases + entry.purchase_count,
      revenueCents: accumulator.revenueCents + entry.revenue_cents,
    }),
    { views: 0, purchases: 0, revenueCents: 0 }
  );

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <SellerProductPromotionsWorkspace
          productId={product.id}
          productTitle={product.title}
          productSlug={product.slug}
          priceCents={product.price_cents}
          activeReleaseVersion={activeReleaseResult.data?.version || null}
          campaigns={(campaignsResult.data || []) as SellerProductCampaignItem[]}
          coupons={(couponsResult.data || []) as SellerProductCouponItem[]}
          metrics={analytics}
        />
      </section>
    </main>
  );
}
