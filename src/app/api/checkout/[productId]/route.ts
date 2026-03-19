import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{
    productId: string;
  }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { productId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
    }

    await supabase.rpc("ensure_profile_exists");

    const requestPayload = (await request.json().catch(() => null)) as
      | { couponCode?: string }
      | null;
    const couponCode = requestPayload?.couponCode?.trim() || null;

    const { data, error } = await supabase.rpc("create_checkout_order", {
      p_product_id: productId,
      p_coupon_code: couponCode,
    });

    if (error) {
      const message = error.message || "No se pudo completar la compra";
      const status =
        message === "Producto no encontrado"
          ? 404
          : message === "Ya tienes este producto en tu biblioteca"
            ? 409
            : message === "No puedes comprar tu propio producto"
              ? 400
              : message === "Cupon no valido" ||
                  message === "No puedes aplicar cupones a productos gratuitos"
                ? 400
              : message === "Necesitas iniciar sesion"
                ? 401
                : message === "Solo puedes comprar productos aprobados" ||
                    message === "Perfil no encontrado"
                  ? 403
                  : 500;

      return NextResponse.json({ message }, { status });
    }

    const resultPayload = Array.isArray(data) ? data[0] : data;

    if (!resultPayload) {
      return NextResponse.json(
        { message: "La compra no devolvio un resultado valido" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: resultPayload.message,
      orderId: resultPayload.order_id,
      licenseIssued: resultPayload.license_issued,
      licenseKey: resultPayload.license_key,
      couponCode: resultPayload.coupon_code,
      discountCents: resultPayload.discount_cents,
      totalCents: resultPayload.total_cents,
    });
  } catch {
    return NextResponse.json(
      { message: "Ocurrio un error inesperado al completar la compra" },
      { status: 500 }
    );
  }
}
