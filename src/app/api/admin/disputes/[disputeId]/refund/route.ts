import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { createUserNotification } from "@/lib/notifications";
import {
  getPostSaleGuardrailSnapshot,
  summarizePostSaleGuardrails,
} from "@/lib/risk/post-sale-guardrails";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface RefundDisputeRow {
  id: string;
  order_id: string | null;
  license_id: string | null;
  product_id: string | null;
  opened_by_user_id: string;
  status: "open" | "reviewing" | "resolved" | "rejected";
}

interface RefundOrderRow {
  id: string;
  status: "pending" | "completed" | "failed" | "refunded";
  user_id: string;
}

export async function POST(
  _request: Request,
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

  const adminSupabase = createAdminClient();
  const { data: dispute } = (await adminSupabase
    .from("disputes")
    .select("id, order_id, license_id, product_id, opened_by_user_id, status")
    .eq("id", disputeId)
    .maybeSingle()) as { data: RefundDisputeRow | null };

  if (!dispute?.order_id) {
    return NextResponse.json(
      { message: "La disputa no tiene un pedido asociado para emitir reembolso" },
      { status: 409 }
    );
  }

  if (dispute.status === "rejected") {
    return NextResponse.json(
      { message: "Reabre o revisa el caso antes de emitir un reembolso" },
      { status: 409 }
    );
  }

  if (dispute.status !== "reviewing") {
    return NextResponse.json(
      { message: "Pon la disputa en revision antes de emitir un reembolso" },
      { status: 409 }
    );
  }

  const { data: order } = (await adminSupabase
    .from("orders")
    .select("id, status, user_id")
    .eq("id", dispute.order_id)
    .maybeSingle()) as { data: RefundOrderRow | null };

  if (!order) {
    return NextResponse.json({ message: "No se encontro el pedido asociado" }, { status: 404 });
  }

  if (order.status === "refunded") {
    return NextResponse.json({ message: "El pedido ya figura como reembolsado" }, { status: 409 });
  }

  const guardrails = await getPostSaleGuardrailSnapshot(adminSupabase, {
    buyerUserId: dispute.opened_by_user_id,
    productId: dispute.product_id,
    orderId: dispute.order_id,
    licenseId: dispute.license_id,
    disputeId: dispute.id,
  });

  const now = new Date().toISOString();
  const { error: orderError } = await (adminSupabase.from("orders") as any)
    .update({
      status: "refunded",
    })
    .eq("id", order.id);

  if (orderError) {
    return NextResponse.json({ message: "No se pudo marcar el pedido como reembolsado" }, { status: 500 });
  }

  if (dispute.license_id) {
    const { error: licenseError } = await (adminSupabase.from("licenses") as any)
      .update({
        status: "revoked",
        last_validated_at: now,
      })
      .eq("id", dispute.license_id);

    if (licenseError) {
      return NextResponse.json(
        { message: "El pedido se reembolso, pero no se pudo revocar la licencia asociada" },
        { status: 500 }
      );
    }
  }

  const { error: disputeError } = await (adminSupabase.from("disputes") as any)
    .update({
      status: "resolved",
      assigned_admin_user_id: user.id,
      updated_at: now,
    })
    .eq("id", dispute.id);

  if (disputeError) {
    return NextResponse.json(
      { message: "El pedido se reembolso, pero no se pudo cerrar la disputa" },
      { status: 500 }
    );
  }

  await Promise.all([
    recordAuditLog({
      actorUserId: user.id,
      action: "order.refunded",
      entityType: "order",
      entityId: order.id,
      metadata: {
        dispute_id: dispute.id,
        product_id: dispute.product_id,
        buyer_user_id: order.user_id,
      },
    }),
    recordAuditLog({
      actorUserId: user.id,
      action: "dispute.refund_granted",
      entityType: "dispute",
      entityId: dispute.id,
      metadata: {
        order_id: order.id,
        license_id: dispute.license_id,
        product_id: dispute.product_id,
      },
    }),
    dispute.license_id
      ? recordAuditLog({
          actorUserId: user.id,
          action: "license.revoked_for_refund",
          entityType: "license",
          entityId: dispute.license_id,
          metadata: {
            order_id: order.id,
            dispute_id: dispute.id,
            product_id: dispute.product_id,
          },
        })
      : Promise.resolve({ error: null }),
    createUserNotification({
      recipientUserId: dispute.opened_by_user_id,
      actorUserId: user.id,
      kind: "refund_granted",
      title: "Tu reembolso fue aprobado",
      body: "El marketplace marco tu pedido como reembolsado y cerro la disputa asociada.",
      href: `/disputes/${dispute.id}`,
      entityType: "dispute",
      entityId: dispute.id,
      metadata: {
        order_id: order.id,
        license_id: dispute.license_id,
        product_id: dispute.product_id,
      },
    }),
    guardrails.signals.length > 0
      ? (adminSupabase.from("risk_events") as any).insert({
          entity_type: "dispute",
          entity_id: dispute.id,
          user_id: dispute.opened_by_user_id,
          severity: guardrails.overallSeverity || "medium",
          code: "post_sale_guardrail_triggered",
          title: "Refund emitido con senales postventa relevantes",
          details: summarizePostSaleGuardrails(guardrails),
          status: "open",
        })
      : Promise.resolve({ error: null }),
  ]);

  return NextResponse.json({ message: "Reembolso emitido y disputa cerrada correctamente" });
}
