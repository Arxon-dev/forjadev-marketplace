import { createClient } from "@/lib/supabase/server";

export async function requireOwnedProductRouteUser(productId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, status: 401, message: "Necesitas iniciar sesion" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "seller") {
    return { ok: false as const, status: 403, message: "Acceso denegado" };
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vendor) {
    return { ok: false as const, status: 403, message: "No tienes una tienda activa" };
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, vendor_id, title, moderation_status")
    .eq("id", productId)
    .eq("vendor_id", vendor.id)
    .maybeSingle();

  if (!product) {
    return { ok: false as const, status: 404, message: "Producto no encontrado" };
  }

  return { ok: true as const, user, vendor, product };
}
