import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ACTION_STATUS = {
  approve: "approved",
  reject: "rejected",
  hide: "hidden",
  pending: "pending",
} as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ productId: string }> }
) {
  const { productId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Necesitas iniciar sesión" }, { status: 401 });
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
    | { action?: keyof typeof ACTION_STATUS; reason?: string }
    | null;

  const action = payload?.action;

  if (!action || !(action in ACTION_STATUS)) {
    return NextResponse.json({ message: "Acción de moderación inválida" }, { status: 400 });
  }

  const reason = payload?.reason?.trim() || null;

  if (action === "reject" && !reason) {
    return NextResponse.json(
      { message: "Debes indicar un motivo de rechazo" },
      { status: 400 }
    );
  }

  const adminSupabase = createAdminClient();
  const newStatus = ACTION_STATUS[action];

  const adminProducts = adminSupabase.from("products") as any;

  const { data: product, error: productError } = await adminProducts
    .update({
      moderation_status: newStatus,
      rejection_reason: action === "reject" ? reason : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .select("id, title, moderation_status")
    .single();

  if (productError || !product) {
    return NextResponse.json(
      { message: "No se pudo actualizar el estado del producto" },
      { status: 500 }
    );
  }

  const { error: auditError } = await recordAuditLog({
    actorUserId: user.id,
    action: `product.${action}`,
    entityType: "product",
    entityId: productId,
    metadata: {
      new_status: newStatus,
      reason,
    },
  });

  if (auditError) {
    return NextResponse.json(
      { message: "El producto cambió de estado, pero no se pudo registrar auditoría" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Estado actualizado correctamente",
    status: product.moderation_status,
  });
}
