import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function ensureCollectionOwnership(collectionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      collection: null,
      response: NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 }),
    };
  }

  await supabase.rpc("ensure_profile_exists");

  const { data: collection } = await supabase
    .from("collections")
    .select("id, user_id")
    .eq("id", collectionId)
    .maybeSingle();

  if (!collection) {
    return {
      supabase,
      user,
      collection: null,
      response: NextResponse.json({ message: "Coleccion no encontrada" }, { status: 404 }),
    };
  }

  if (collection.user_id !== user.id) {
    return {
      supabase,
      user,
      collection: null,
      response: NextResponse.json(
        { message: "No puedes modificar esta coleccion" },
        { status: 403 }
      ),
    };
  }

  return { supabase, user, collection, response: null };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await context.params;
  const access = await ensureCollectionOwnership(collectionId);

  if (access.response) {
    return access.response;
  }

  const payload = (await request.json().catch(() => null)) as { productId?: string } | null;
  const productId = payload?.productId;

  if (!productId) {
    return NextResponse.json({ message: "Debes indicar un producto" }, { status: 400 });
  }

  const { data: product } = await access.supabase
    .from("products")
    .select("id, moderation_status")
    .eq("id", productId)
    .maybeSingle();

  if (!product || product.moderation_status !== "approved") {
    return NextResponse.json({ message: "Producto no disponible" }, { status: 404 });
  }

  const { error } = await access.supabase.from("collection_items").insert({
    collection_id: collectionId,
    product_id: productId,
  });

  if (error && error.code !== "23505") {
    return NextResponse.json(
      { message: error.message || "No se pudo anadir el producto" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Producto anadido correctamente" });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await context.params;
  const access = await ensureCollectionOwnership(collectionId);

  if (access.response) {
    return access.response;
  }

  const payload = (await request.json().catch(() => null)) as { productId?: string } | null;
  const productId = payload?.productId;

  if (!productId) {
    return NextResponse.json({ message: "Debes indicar un producto" }, { status: 400 });
  }

  const { error } = await access.supabase
    .from("collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("product_id", productId);

  if (error) {
    return NextResponse.json(
      { message: error.message || "No se pudo quitar el producto" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Producto eliminado de la coleccion" });
}
