import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{
    bundleId: string;
  }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { bundleId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
    }

    await supabase.rpc("ensure_profile_exists");

    const { data, error } = await supabase.rpc("create_bundle_checkout_order", {
      p_bundle_id: bundleId,
    });

    if (error) {
      const message = error.message || "No se pudo completar la compra del bundle";
      const status =
        message === "Bundle no encontrado"
          ? 404
          : message === "No puedes comprar tu propio bundle" ||
              message === "Este bundle no tiene productos disponibles" ||
              message === "Este bundle incluye productos no disponibles" ||
              message === "El bundle no tiene un precio comercial valido" ||
              message === "Ya tienes uno o mas productos de este bundle en tu biblioteca"
            ? 400
          : message === "Necesitas iniciar sesion"
            ? 401
          : message === "Perfil no encontrado" || message === "Este bundle no esta disponible"
            ? 403
          : 500;

      return NextResponse.json({ message }, { status });
    }

    const resultPayload = Array.isArray(data) ? data[0] : data;

    if (!resultPayload) {
      return NextResponse.json(
        { message: "La compra del bundle no devolvio un resultado valido" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: resultPayload.message,
      orderId: resultPayload.order_id,
      totalCents: resultPayload.total_cents,
      itemCount: resultPayload.item_count,
      licensesIssued: resultPayload.licenses_issued,
    });
  } catch {
    return NextResponse.json(
      { message: "Ocurrio un error inesperado al completar la compra del bundle" },
      { status: 500 }
    );
  }
}
