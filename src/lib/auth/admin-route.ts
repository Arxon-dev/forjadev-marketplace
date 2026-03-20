import { createClient } from "@/lib/supabase/server";

export async function requireAdminRouteUser() {
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

  if (profile?.role !== "admin") {
    return { ok: false as const, status: 403, message: "Acceso denegado" };
  }

  return { ok: true as const, user };
}
