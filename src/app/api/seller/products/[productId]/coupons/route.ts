import { NextResponse } from "next/server";
import { requireOwnedProductRouteUser } from "@/lib/auth/seller-route";
import { buildCouponPayload } from "@/lib/seller/product-promotions";
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
        code?: string;
        discountType?: "percent" | "fixed";
        discountValue?: number | null;
        startsAt?: string | null;
        endsAt?: string | null;
        maxRedemptions?: number | null;
        isActive?: boolean;
      }
    | null;

  try {
    const normalized = buildCouponPayload({
      code: payload?.code,
      discountType: payload?.discountType,
      discountValue: payload?.discountValue,
      startsAt: payload?.startsAt,
      endsAt: payload?.endsAt,
      maxRedemptions: payload?.maxRedemptions ?? null,
    });

    const adminSupabase = createAdminClient();
    const { data, error } = await (adminSupabase.from("coupons") as any)
      .insert([
        {
          vendor_id: access.vendor.id,
          product_id: productId,
          is_active: payload?.isActive ?? true,
          redemption_count: 0,
          ...normalized,
        },
      ])
      .select("id")
      .single();

    if (error || !data) {
      const message =
        error?.code === "23505"
          ? "Ya existe un cupon con ese codigo."
          : error?.message || "No se pudo crear el cupon.";
      throw new Error(message);
    }

    return NextResponse.json({ ok: true, couponId: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el cupon.";
    const status =
      message.includes("Ya existe") ? 409 : message.includes("No se pudo") ? 500 : 400;
    return NextResponse.json({ message }, { status });
  }
}
