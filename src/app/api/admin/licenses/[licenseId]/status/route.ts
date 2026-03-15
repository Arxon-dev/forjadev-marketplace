import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ACTION_STATUS = {
  revoke: "revoked",
  reactivate: "active",
} as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ licenseId: string }> }
) {
  const { licenseId } = await context.params;
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
    | { action?: keyof typeof ACTION_STATUS }
    | null;

  const action = payload?.action;

  if (!action || !(action in ACTION_STATUS)) {
    return NextResponse.json({ message: "Accion de licencia invalida" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const newStatus = ACTION_STATUS[action];

  const adminLicenses = adminSupabase.from("licenses") as any;

  const { data: license, error: licenseError } = await adminLicenses
    .update({
      status: newStatus,
      last_validated_at: new Date().toISOString(),
    })
    .eq("id", licenseId)
    .select("id, status, product_id, user_id")
    .single();

  if (licenseError || !license) {
    return NextResponse.json(
      { message: "No se pudo actualizar la licencia" },
      { status: 500 }
    );
  }

  const { error: auditError } = await recordAuditLog({
    actorUserId: user.id,
    action: `license.${action}`,
    entityType: "license",
    entityId: licenseId,
    metadata: {
      new_status: newStatus,
      product_id: license.product_id,
      user_id: license.user_id,
    },
  });

  if (auditError) {
    return NextResponse.json(
      { message: "La licencia cambio de estado, pero no se pudo registrar auditoria" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Licencia actualizada correctamente",
    status: license.status,
  });
}
