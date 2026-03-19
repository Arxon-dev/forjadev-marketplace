import { NextResponse } from "next/server";
import { getPersonalizedRecommendations } from "@/lib/intelligence/recommendations";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") || "3");
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(6, Math.max(1, Math.floor(requestedLimit)))
      : 3;

    const recommendations = await getPersonalizedRecommendations(user.id, limit);

    return NextResponse.json({ recommendations });
  } catch {
    return NextResponse.json(
      { message: "No se pudieron cargar las recomendaciones personalizadas" },
      { status: 500 }
    );
  }
}
