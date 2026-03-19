import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        orderId?: string;
        productId?: string;
        licenseId?: string | null;
        reason?: string;
      }
    | null;

  const orderId = payload?.orderId?.trim();
  const productId = payload?.productId?.trim();
  const licenseId = payload?.licenseId?.trim() || null;
  const reason = payload?.reason?.trim();

  if (!orderId || !productId || !reason) {
    return NextResponse.json({ message: "Faltan datos para abrir la disputa" }, { status: 400 });
  }

  const [{ data: order }, { data: license }, { data: duplicate }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, user_id, status")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle(),
    licenseId
      ? supabase
          .from("licenses")
          .select("id, user_id, product_id")
          .eq("id", licenseId)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("disputes")
      .select("id")
      .eq("opened_by_user_id", user.id)
      .eq("order_id", orderId)
      .eq("product_id", productId)
      .in("status", ["open", "reviewing"])
      .limit(1)
      .maybeSingle(),
  ]);

  if (!order || order.status !== "completed") {
    return NextResponse.json({ message: "No se encontro un pedido valido para esta disputa" }, { status: 404 });
  }

  const { data: ownedItem } = await supabase
    .from("order_items")
    .select("id, product_id")
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .limit(1)
    .maybeSingle();

  if (!ownedItem) {
    return NextResponse.json({ message: "Ese producto no pertenece a tu pedido" }, { status: 403 });
  }

  if (licenseId && (!license || license.product_id !== productId)) {
    return NextResponse.json({ message: "La licencia no coincide con este producto" }, { status: 403 });
  }

  if (duplicate?.id) {
    return NextResponse.json({ message: "Ya tienes una disputa activa para este producto" }, { status: 409 });
  }

  const adminSupabase = createAdminClient();
  const { data: dispute, error } = await (adminSupabase.from("disputes") as any)
    .insert({
      order_id: orderId,
      license_id: licenseId,
      product_id: productId,
      opened_by_user_id: user.id,
      reason,
    })
    .select("id, status")
    .single();

  if (error || !dispute) {
    return NextResponse.json({ message: "No se pudo abrir la disputa" }, { status: 500 });
  }

  await (adminSupabase.from("risk_events") as any).insert({
    entity_type: "dispute",
    entity_id: dispute.id,
    user_id: user.id,
    severity: "medium",
    code: "buyer_dispute_opened",
    title: "Nueva disputa abierta",
    details: "Un buyer ha solicitado revision administrativa sobre una compra o licencia.",
    status: "open",
  });

  await recordAuditLog({
    actorUserId: user.id,
    action: "dispute.created",
    entityType: "dispute",
    entityId: dispute.id,
    metadata: {
      order_id: orderId,
      product_id: productId,
      license_id: licenseId,
      status: dispute.status,
    },
  });

  return NextResponse.json({
    disputeId: dispute.id,
    message: "Disputa abierta correctamente",
  });
}
