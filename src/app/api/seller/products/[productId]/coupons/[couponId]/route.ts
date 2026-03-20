import { NextResponse } from "next/server";
import { requireOwnedProductRouteUser } from "@/lib/auth/seller-route";
import { buildCouponPayload } from "@/lib/seller/product-promotions";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{
    productId: string;
    couponId: string;
  }>;
}

async function getOwnedCouponOrThrow(productId: string, couponId: string, vendorId: string) {
  const adminSupabase = createAdminClient();
  const { data, error } = await (adminSupabase.from("coupons") as any)
    .select("id, vendor_id, product_id, redemption_count")
    .eq("id", couponId)
    .eq("vendor_id", vendorId)
    .eq("product_id", productId)
    .single();

  if (error || !data) {
    throw new Error("Cupon no encontrado.");
  }

  return { adminSupabase, coupon: data };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { productId, couponId } = await params;
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
    const { adminSupabase, coupon } = await getOwnedCouponOrThrow(
      productId,
      couponId,
      access.vendor.id
    );
    const normalized = buildCouponPayload({
      code: payload?.code,
      discountType: payload?.discountType,
      discountValue: payload?.discountValue,
      startsAt: payload?.startsAt,
      endsAt: payload?.endsAt,
      maxRedemptions: payload?.maxRedemptions ?? null,
    });

    if (
      normalized.max_redemptions !== null &&
      normalized.max_redemptions < Number(coupon.redemption_count || 0)
    ) {
      return NextResponse.json(
        { message: "El maximo de usos no puede ser menor que los canjes ya realizados." },
        { status: 400 }
      );
    }

    const { error } = await (adminSupabase.from("coupons") as any)
      .update({
        is_active: payload?.isActive ?? true,
        ...normalized,
      })
      .eq("id", couponId);

    if (error) {
      const message =
        error.code === "23505"
          ? "Ya existe un cupon con ese codigo."
          : error.message || "No se pudo actualizar el cupon.";
      throw new Error(message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el cupon.";
    const status =
      message.includes("Ya existe")
        ? 409
        : message.includes("no encontrado")
          ? 404
          : message.includes("No se pudo")
            ? 500
            : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { productId, couponId } = await params;
  const access = await requireOwnedProductRouteUser(productId);

  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  try {
    const { adminSupabase, coupon } = await getOwnedCouponOrThrow(
      productId,
      couponId,
      access.vendor.id
    );

    if (Number(coupon.redemption_count || 0) > 0) {
      return NextResponse.json(
        { message: "No puedes eliminar un cupon que ya tiene canjes registrados." },
        { status: 409 }
      );
    }

    const { error } = await (adminSupabase.from("coupons") as any).delete().eq("id", couponId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo eliminar el cupon.";
    const status = message.includes("no encontrado") ? 404 : 500;
    return NextResponse.json({ message }, { status });
  }
}
