import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{
    productId: string;
  }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
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

    const { data, error } = await supabase.rpc("create_checkout_order", {
      p_product_id: productId,
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
              : message === "Necesitas iniciar sesion"
                ? 401
                : message === "Solo puedes comprar productos aprobados" ||
                    message === "Perfil no encontrado"
                  ? 403
                  : 500;

      return NextResponse.json({ message }, { status });
    }

    const payload = Array.isArray(data) ? data[0] : data;

    if (!payload) {
      return NextResponse.json(
        { message: "La compra no devolvio un resultado valido" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: payload.message,
      orderId: payload.order_id,
      licenseIssued: payload.license_issued,
      licenseKey: payload.license_key,
    });
  } catch {
    return NextResponse.json(
      { message: "Ocurrio un error inesperado al completar la compra" },
      { status: 500 }
    );
  }
}
