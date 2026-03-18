import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

interface MarketplaceEventPayload {
  sessionId?: string;
  eventName?: string;
  pageType?: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Json;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MarketplaceEventPayload;

    if (!body.sessionId || !body.eventName || !body.pageType) {
      return NextResponse.json({ error: "Payload incompleto" }, { status: 400 });
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminSupabase = createAdminClient();
    const marketplaceEvents = adminSupabase.from("marketplace_events") as any;

    const { error } = await marketplaceEvents.insert([
      {
        actor_user_id: user?.id ?? null,
        session_id: body.sessionId,
        event_name: body.eventName,
        page_type: body.pageType,
        entity_type: body.entityType ?? null,
        entity_id: body.entityId ?? null,
        metadata: body.metadata ?? null,
      },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo registrar el evento";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
