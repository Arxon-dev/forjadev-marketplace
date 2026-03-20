import { NextResponse } from "next/server";
import { requireOwnedProductRouteUser } from "@/lib/auth/seller-route";
import { buildCampaignPayload } from "@/lib/seller/product-promotions";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{
    productId: string;
    campaignId: string;
  }>;
}

async function getOwnedCampaignOrThrow(productId: string, campaignId: string, vendorId: string) {
  const adminSupabase = createAdminClient();
  const { data, error } = await (adminSupabase.from("campaigns") as any)
    .select("id, vendor_id, product_id, is_active")
    .eq("id", campaignId)
    .eq("vendor_id", vendorId)
    .eq("product_id", productId)
    .single();

  if (error || !data) {
    throw new Error("Campana no encontrada.");
  }

  return { adminSupabase, campaign: data };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { productId, campaignId } = await params;
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

    const { adminSupabase } = await getOwnedCampaignOrThrow(productId, campaignId, access.vendor.id);
    const { error } = await (adminSupabase.from("campaigns") as any)
      .update({
        is_active: payload?.isActive ?? true,
        ...normalized,
      })
      .eq("id", campaignId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar la campana.";
    const status = message.includes("no encontrada") ? 404 : message.includes("No se pudo") ? 500 : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { productId, campaignId } = await params;
  const access = await requireOwnedProductRouteUser(productId);

  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  try {
    const { adminSupabase } = await getOwnedCampaignOrThrow(productId, campaignId, access.vendor.id);
    const { error } = await (adminSupabase.from("campaigns") as any).delete().eq("id", campaignId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo eliminar la campana.";
    const status = message.includes("no encontrada") ? 404 : 500;
    return NextResponse.json({ message }, { status });
  }
}
