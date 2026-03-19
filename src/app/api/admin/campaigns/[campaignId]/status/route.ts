import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ACTION_ACTIVE = {
  pause: false,
  activate: true,
} as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as
    | { action?: keyof typeof ACTION_ACTIVE }
    | null;

  const action = payload?.action;

  if (!action || !(action in ACTION_ACTIVE)) {
    return NextResponse.json({ message: "Accion de campana invalida" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const campaigns = adminSupabase.from("campaigns") as any;

  const { data: campaign, error: campaignError } = await campaigns
    .update({ is_active: ACTION_ACTIVE[action] })
    .eq("id", campaignId)
    .select("id, title, campaign_type, vendor_id, product_id, bundle_id, is_active")
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json(
      { message: "No se pudo actualizar la campana" },
      { status: 500 }
    );
  }

  const { error: auditError } = await recordAuditLog({
    actorUserId: user.id,
    action: `campaign.${action}`,
    entityType: "campaign",
    entityId: campaignId,
    metadata: {
      title: campaign.title,
      campaign_type: campaign.campaign_type,
      vendor_id: campaign.vendor_id,
      product_id: campaign.product_id,
      bundle_id: campaign.bundle_id,
      is_active: campaign.is_active,
    },
  });

  if (auditError) {
    return NextResponse.json(
      { message: "La campana cambio de estado, pero no se pudo registrar auditoria" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Campana actualizada correctamente",
    isActive: campaign.is_active,
  });
}
