import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ discussionId: string }> }
) {
  const { discussionId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
  }

  await supabase.rpc("ensure_profile_exists");

  const payload = (await request.json().catch(() => null)) as { body?: string } | null;
  const body = payload?.body?.trim();

  if (!body) {
    return NextResponse.json({ message: "Debes escribir una respuesta" }, { status: 400 });
  }

  const { data: discussion } = await supabase
    .from("product_discussions")
    .select("id, is_locked")
    .eq("id", discussionId)
    .maybeSingle();

  if (!discussion) {
    return NextResponse.json({ message: "Discusion no encontrada" }, { status: 404 });
  }

  if (discussion.is_locked) {
    return NextResponse.json({ message: "La discusion esta bloqueada" }, { status: 400 });
  }

  const { error } = await supabase.from("discussion_messages").insert({
    discussion_id: discussionId,
    author_user_id: user.id,
    body,
  });

  if (error) {
    return NextResponse.json(
      { message: error.message || "No se pudo publicar la respuesta" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "Respuesta publicada correctamente" });
}
