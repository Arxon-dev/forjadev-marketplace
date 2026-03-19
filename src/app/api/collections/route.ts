import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function slugifyCollectionTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
  }

  await supabase.rpc("ensure_profile_exists");

  const payload = (await request.json().catch(() => null)) as
    | {
        title?: string;
        description?: string;
        isPublic?: boolean;
        initialProductId?: string;
      }
    | null;

  const title = payload?.title?.trim();
  const description = payload?.description?.trim() || null;
  const isPublic = payload?.isPublic ?? true;
  const initialProductId = payload?.initialProductId || null;

  if (!title) {
    return NextResponse.json(
      { message: "Debes indicar un titulo para la coleccion" },
      { status: 400 }
    );
  }

  if (title.length > 80) {
    return NextResponse.json(
      { message: "El titulo no puede superar 80 caracteres" },
      { status: 400 }
    );
  }

  if (description && description.length > 500) {
    return NextResponse.json(
      { message: "La descripcion no puede superar 500 caracteres" },
      { status: 400 }
    );
  }

  if (initialProductId) {
    const { data: product } = await supabase
      .from("products")
      .select("id, moderation_status")
      .eq("id", initialProductId)
      .maybeSingle();

    if (!product || product.moderation_status !== "approved") {
      return NextResponse.json({ message: "Producto no disponible" }, { status: 404 });
    }
  }

  const baseSlug = slugifyCollectionTitle(title) || "collection";
  let slug = baseSlug;
  let suffix = 1;

  while (suffix <= 10) {
    const { data: existing } = await adminSupabase
      .from("collections")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!existing) {
      break;
    }

    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const { data: collection, error: collectionError } = await supabase
    .from("collections")
    .insert({
      user_id: user.id,
      title,
      slug,
      description,
      is_public: isPublic,
    })
    .select("id, title, slug, description, is_public, created_at, updated_at")
    .single();

  if (collectionError || !collection) {
    return NextResponse.json(
      { message: collectionError?.message || "No se pudo crear la coleccion" },
      { status: 500 }
    );
  }

  if (initialProductId) {
    const { error: itemError } = await supabase.from("collection_items").insert({
      collection_id: collection.id,
      product_id: initialProductId,
    });

    if (itemError) {
      await supabase.from("collections").delete().eq("id", collection.id);

      return NextResponse.json(
        { message: itemError.message || "No se pudo anadir el producto inicial" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    message: "Coleccion creada correctamente",
    collection: {
      ...collection,
      item_count: initialProductId ? 1 : 0,
    },
  });
}
