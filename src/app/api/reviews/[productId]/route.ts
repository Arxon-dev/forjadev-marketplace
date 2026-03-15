import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{
    productId: string;
  }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { productId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { rating?: number; title?: string; body?: string }
    | null;

  const rating = body?.rating;
  const reviewTitle = body?.title?.trim() || null;
  const reviewBody = body?.body?.trim() || null;

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ message: "La puntuacion debe estar entre 1 y 5" }, { status: 400 });
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, is_free, moderation_status, vendor_id")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    return NextResponse.json({ message: "Producto no encontrado" }, { status: 404 });
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("user_id")
    .eq("id", product.vendor_id)
    .single();

  if (vendor?.user_id === user.id) {
    return NextResponse.json(
      { message: "No puedes valorar tu propio producto" },
      { status: 403 }
    );
  }

  let hasAccess = false;

  if (product.is_free) {
    const { data: download } = await supabase
      .from("downloads")
      .select("id")
      .eq("product_id", productId)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    hasAccess = Boolean(download);
  } else {
    const { data: purchase } = await supabase
      .from("order_items")
      .select("id, order:orders!inner(status, user_id)")
      .eq("product_id", productId)
      .eq("order.user_id", user.id)
      .eq("order.status", "completed")
      .limit(1)
      .maybeSingle();

    hasAccess = Boolean(purchase);
  }

  if (!hasAccess || product.moderation_status !== "approved") {
    return NextResponse.json(
      { message: "Solo puedes valorar productos aprobados que hayas adquirido" },
      { status: 403 }
    );
  }

  const { data: existingReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("product_id", productId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existingReview) {
    return NextResponse.json({ message: "Ya has enviado una valoracion" }, { status: 409 });
  }

  const { error: reviewError } = await supabase.from("reviews").insert([
    {
      product_id: productId,
      user_id: user.id,
      rating,
      title: reviewTitle,
      body: reviewBody,
    },
  ]);

  if (reviewError) {
    return NextResponse.json(
      { message: reviewError.message || "No se pudo guardar la valoracion" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
