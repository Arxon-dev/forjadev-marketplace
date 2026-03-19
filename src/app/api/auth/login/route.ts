import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type ProfileEmailRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "email">;

function isEmailIdentifier(value: string) {
  return value.includes("@");
}

async function resolveEmail(identifier: string) {
  const normalized = identifier.trim();

  if (!normalized) {
    return null;
  }

  if (isEmailIdentifier(normalized)) {
    return normalized;
  }

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("email")
    .ilike("username", normalized)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProfileEmailRow | null)?.email ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      identifier?: string;
      password?: string;
    };

    const identifier = body.identifier?.trim() ?? "";
    const password = body.password ?? "";

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Por favor completa todos los campos" },
        { status: 400 }
      );
    }

    const email = await resolveEmail(identifier);

    if (!email) {
      return NextResponse.json(
        { error: "Credenciales invalidas" },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: "Credenciales invalidas" },
        { status: 401 }
      );
    }

    const { error: profileError } = await supabase.rpc("ensure_profile_exists");

    if (profileError) {
      return NextResponse.json(
        { error: "No se pudo preparar el perfil del usuario" },
        { status: 500 }
      );
    }

    await supabase.rpc("sync_user_provider_identities");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error en el inicio de sesion";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
