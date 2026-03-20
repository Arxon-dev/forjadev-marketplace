import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { activateRelease, retireRelease } from "@/lib/seller/release-lifecycle";
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
  const adminProducts = adminSupabase.from("products") as any;
  const adminVersions = adminSupabase.from("product_versions") as any;

  const { data: currentProduct } = await adminProducts
    .select("id, title, moderation_status")
    .eq("id", productId)
    .single();

  if (!currentProduct) {
    return NextResponse.json({ message: "Producto no encontrado" }, { status: 404 });
  }

  const { data: pendingRelease } = await adminVersions
    .select("id, version")
    .eq("product_id", productId)
    .eq("release_status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingRelease && action === "approve") {
    try {
      await activateRelease(adminSupabase, productId, pendingRelease.id);
    } catch (error) {
      return NextResponse.json(
        {
          message:
            error instanceof Error ? error.message : "No se pudo activar la release pendiente",
        },
        { status: 409 }
      );
    }
  }

  if (pendingRelease && action === "reject") {
    try {
      await retireRelease(adminSupabase, productId, pendingRelease.id, `admin_rejected:${reason}`);
    } catch (error) {
      return NextResponse.json(
        {
          message:
            error instanceof Error ? error.message : "No se pudo retirar la release pendiente",
        },
        { status: 409 }
      );
    }
  }

  const newStatus =
    pendingRelease && currentProduct.moderation_status === "approved" && action === "reject"
      ? "approved"
      : ACTION_STATUS[action];

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
        moderated_pending_release: pendingRelease?.id || null,
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
