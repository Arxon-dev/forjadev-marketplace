import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "");
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Necesitas iniciar sesion" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        displayName?: string;
        username?: string;
      }
    | null;

  const displayName = body?.displayName?.trim() || "";
  const username = normalizeUsername(body?.username || "");

  if (!displayName) {
    return NextResponse.json({ error: "El nombre visible es obligatorio" }, { status: 400 });
  }

  if (!username || username.length < 3) {
    return NextResponse.json(
      { error: "El nombre de usuario debe tener al menos 3 caracteres validos" },
      { status: 400 }
    );
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json({ error: "Ese nombre de usuario ya esta en uso" }, { status: 409 });
  }

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      username,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("display_name, username, role")
    .single();

  if (error || !updatedProfile) {
    return NextResponse.json(
      { error: error?.message || "No se pudo actualizar el perfil" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    profile: {
      displayName: updatedProfile.display_name,
      username: updatedProfile.username,
      role: updatedProfile.role,
    },
  });
}
