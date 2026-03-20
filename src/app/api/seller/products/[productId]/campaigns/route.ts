import { NextResponse } from "next/server";
import { requireOwnedProductRouteUser } from "@/lib/auth/seller-route";
import { buildCampaignPayload } from "@/lib/seller/product-promotions";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{
    productId: string;
  }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { productId } = await params;
  const access = await requireOwnedProductRouteUser(productId);

  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        title?: string;
        campaignType?: "flash_deal" | "launch_discount" | "featured_placement";
        discountType?: "percent" | "fixed" | null;
        discountValue?: number | null;
        startsAt?: string | null;
        endsAt?: string | null;
        isActive?: boolean;
      }
    | null;

  try {
    const normalized = buildCampaignPayload({
      title: payload?.title,
      campaignType: payload?.campaignType,
      discountType: payload?.discountType,
      discountValue: payload?.discountValue,
      startsAt: payload?.startsAt,
      endsAt: payload?.endsAt,
    });

    const adminSupabase = createAdminClient();
    const { data, error } = await (adminSupabase.from("campaigns") as any)
      .insert([
        {
          vendor_id: access.vendor.id,
          product_id: productId,
          bundle_id: null,
          is_active: payload?.isActive ?? true,
          ...normalized,
        },
      ])
      .select("id")
      .single();

    if (error || !data) {
      throw error || new Error("No se pudo crear la campana.");
    }

    return NextResponse.json({ ok: true, campaignId: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la campana.";
    const status = message.includes("No se pudo") ? 500 : 400;
    return NextResponse.json({ message }, { status });
  }
}
