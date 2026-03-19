import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { createUserNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type DisputeStatus = "open" | "reviewing" | "resolved" | "rejected";

export async function POST(
  request: Request,
  context: { params: Promise<{ disputeId: string }> }
) {
  const { disputeId } = await context.params;
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

  const payload = (await request.json().catch(() => null)) as { status?: DisputeStatus } | null;
  const nextStatus = payload?.status;

  if (!nextStatus || !["open", "reviewing", "resolved", "rejected"].includes(nextStatus)) {
    return NextResponse.json({ message: "Estado de disputa invalido" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const disputes = adminSupabase.from("disputes") as any;

  const { data: dispute, error } = await disputes
    .update({
      status: nextStatus,
      assigned_admin_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", disputeId)
    .select("id, opened_by_user_id, order_id, license_id, product_id, reason, status, assigned_admin_user_id")
    .single();

  if (error || !dispute) {
    return NextResponse.json({ message: "No se pudo actualizar la disputa" }, { status: 500 });
  }

  await recordAuditLog({
    actorUserId: user.id,
    action: `dispute.${nextStatus}`,
    entityType: "dispute",
    entityId: disputeId,
    metadata: {
      order_id: dispute.order_id,
      license_id: dispute.license_id,
      product_id: dispute.product_id,
      assigned_admin_user_id: dispute.assigned_admin_user_id,
      status: dispute.status,
    },
  });

  await createUserNotification({
    recipientUserId: dispute.opened_by_user_id,
    actorUserId: user.id,
    kind: "dispute_status_changed",
    title:
      nextStatus === "reviewing"
        ? "Tu disputa esta en revision"
        : nextStatus === "resolved"
          ? "Tu disputa fue resuelta"
          : nextStatus === "rejected"
            ? "Tu disputa fue rechazada"
            : "Tu disputa fue reabierta",
    body: dispute.reason,
    href: "/disputes",
    entityType: "dispute",
    entityId: dispute.id,
    metadata: {
      status: nextStatus,
    },
  });

  return NextResponse.json({ message: "Disputa actualizada correctamente" });
}
