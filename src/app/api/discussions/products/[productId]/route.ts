import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ productId: string }> }
) {
  const { productId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
  }

  await supabase.rpc("ensure_profile_exists");

  const payload = (await request.json().catch(() => null)) as
    | { title?: string; body?: string }
    | null;

  const title = payload?.title?.trim();
  const body = payload?.body?.trim();

  if (!title || !body) {
    return NextResponse.json(
      { message: "Debes indicar titulo y mensaje inicial" },
      { status: 400 }
    );
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, moderation_status")
    .eq("id", productId)
    .maybeSingle();

  if (!product || product.moderation_status !== "approved") {
    return NextResponse.json({ message: "Producto no disponible" }, { status: 404 });
  }

  const { error } = await supabase.from("product_discussions").insert({
    product_id: productId,
    author_user_id: user.id,
    title,
    body,
  });

  if (error) {
    return NextResponse.json(
      { message: error.message || "No se pudo crear la discusion" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Discusion creada correctamente" });
}
