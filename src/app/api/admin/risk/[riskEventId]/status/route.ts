import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RiskStatus = "open" | "resolved" | "ignored";

export async function POST(
  request: Request,
  context: { params: Promise<{ riskEventId: string }> }
) {
  const { riskEventId } = await context.params;
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

  const payload = (await request.json().catch(() => null)) as { status?: RiskStatus } | null;
  const nextStatus = payload?.status;

  if (!nextStatus || !["open", "resolved", "ignored"].includes(nextStatus)) {
    return NextResponse.json({ message: "Estado de riesgo invalido" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const riskEvents = adminSupabase.from("risk_events") as any;

  const { data: riskEvent, error } = await riskEvents
    .update({
      status: nextStatus,
      resolved_at: nextStatus === "open" ? null : new Date().toISOString(),
    })
    .eq("id", riskEventId)
    .select("id, code, title, severity, entity_type, entity_id, status")
    .single();

  if (error || !riskEvent) {
    return NextResponse.json({ message: "No se pudo actualizar el evento de riesgo" }, { status: 500 });
  }

  await recordAuditLog({
    actorUserId: user.id,
    action: `risk_event.${nextStatus}`,
    entityType: "risk_event",
    entityId: riskEventId,
    metadata: {
      code: riskEvent.code,
      title: riskEvent.title,
      severity: riskEvent.severity,
      entity_type: riskEvent.entity_type,
      entity_id: riskEvent.entity_id,
      status: riskEvent.status,
    },
  });

  return NextResponse.json({ message: "Evento de riesgo actualizado correctamente" });
}
