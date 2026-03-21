import { createAdminClient } from "@/lib/supabase/admin";

type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";
type DisputeStatus = "open" | "reviewing" | "resolved" | "rejected";
type RiskSeverity = "low" | "medium" | "high";

interface SupportTicketRow {
  id: string;
  status: SupportTicketStatus;
  priority: "normal" | "high";
  subject: string;
  last_message_at: string;
}

interface DisputeRow {
  id: string;
  status: DisputeStatus;
  reason: string;
  updated_at: string;
}

interface OrderItemRow {
  order_id: string;
}

interface OrderRow {
  id: string;
  status: "pending" | "completed" | "failed" | "refunded";
  created_at: string;
}

interface LicenseRow {
  id: string;
  status: "active" | "revoked";
  last_validated_at: string | null;
}

interface RiskEventRow {
  id: string;
  code: string;
  severity: RiskSeverity;
  title: string;
  created_at: string;
}

export interface SellerPostSaleEvent {
  id: string;
  kind: "ticket" | "dispute" | "refund" | "license" | "risk";
  title: string;
  summary: string;
  tone: string;
  at: string;
}

export interface SellerPostSaleSnapshot {
  metrics: {
    openTickets: number;
    waitingSellerTickets: number;
    activeDisputes: number;
    refundedOrders: number;
    revokedLicenses: number;
    openRiskSignals: number;
  };
  nextAction: string;
  trustSummary: string;
  events: SellerPostSaleEvent[];
}

function eventTone(kind: SellerPostSaleEvent["kind"], severity?: RiskSeverity) {
  if (kind === "ticket") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  if (kind === "dispute") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-200";
  }

  if (kind === "refund") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (kind === "license") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  }

  if (severity === "high") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  }

  if (severity === "medium") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-white/10 bg-white/5 text-[var(--text-soft)]";
}

export async function getSellerProductPostSaleSnapshot(productId: string, vendorId: string) {
  const adminSupabase = createAdminClient();

  const [supportTicketsResult, disputesResult, orderItemsResult, licensesResult] = await Promise.all([
    adminSupabase
      .from("support_tickets")
      .select("id, status, priority, subject, last_message_at")
      .eq("product_id", productId)
      .eq("vendor_id", vendorId)
      .order("last_message_at", { ascending: false })
      .limit(20),
    adminSupabase
      .from("disputes")
      .select("id, status, reason, updated_at")
      .eq("product_id", productId)
      .order("updated_at", { ascending: false })
      .limit(20),
    adminSupabase.from("order_items").select("order_id").eq("product_id", productId),
    adminSupabase
      .from("licenses")
      .select("id, status, last_validated_at")
      .eq("product_id", productId)
      .order("issued_at", { ascending: false })
      .limit(50),
  ]);

  const supportTickets = (supportTicketsResult.data || []) as SupportTicketRow[];
  const disputes = (disputesResult.data || []) as DisputeRow[];
  const orderItems = (orderItemsResult.data || []) as OrderItemRow[];
  const licenses = (licensesResult.data || []) as LicenseRow[];

  const orderIds = Array.from(new Set(orderItems.map((item) => item.order_id)));
  const disputeIds = disputes.map((dispute) => dispute.id);

  const [ordersResult, riskEventsResult] = await Promise.all([
    orderIds.length > 0
      ? adminSupabase.from("orders").select("id, status, created_at").in("id", orderIds)
      : Promise.resolve({ data: [] as OrderRow[] }),
    disputeIds.length > 0
      ? adminSupabase
          .from("risk_events")
          .select("id, code, severity, title, created_at, entity_id")
          .eq("entity_type", "dispute")
          .in("entity_id", disputeIds)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as RiskEventRow[] }),
  ]);

  const orders = (ordersResult.data || []) as OrderRow[];
  const riskEvents = (riskEventsResult.data || []) as RiskEventRow[];

  const metrics = {
    openTickets: supportTickets.filter((ticket) => ticket.status !== "closed").length,
    waitingSellerTickets: supportTickets.filter((ticket) => ticket.status === "waiting_seller").length,
    activeDisputes: disputes.filter((dispute) => dispute.status === "open" || dispute.status === "reviewing").length,
    refundedOrders: orders.filter((order) => order.status === "refunded").length,
    revokedLicenses: licenses.filter((license) => license.status === "revoked").length,
    openRiskSignals: riskEvents.length,
  };

  let nextAction = "Postventa estable. Mantener soporte y promesas del producto alineadas.";
  if (metrics.waitingSellerTickets > 0) {
    nextAction = `Responder ${metrics.waitingSellerTickets} ticket(s) que estan esperando al seller.`;
  } else if (metrics.activeDisputes > 0) {
    nextAction = `Hay ${metrics.activeDisputes} disputa(s) activa(s). Revisa soporte, promesa de producto y posibles bloqueos antes de que escalen mas.`;
  } else if (metrics.refundedOrders > 0 || metrics.revokedLicenses > 0) {
    nextAction = "Revisa la salud postventa reciente: ya hubo refunds o licencias revocadas sobre este producto.";
  }

  const summaryParts = [
    metrics.waitingSellerTickets > 0 ? `${metrics.waitingSellerTickets} ticket(s) esperando seller` : null,
    metrics.activeDisputes > 0 ? `${metrics.activeDisputes} disputa(s) activa(s)` : null,
    metrics.refundedOrders > 0 ? `${metrics.refundedOrders} refund(s) emitido(s)` : null,
    metrics.revokedLicenses > 0 ? `${metrics.revokedLicenses} licencia(s) revocada(s)` : null,
    metrics.openRiskSignals > 0 ? `${metrics.openRiskSignals} senal(es) de riesgo abierta(s)` : null,
  ].filter(Boolean);

  const trustSummary =
    summaryParts.length > 0
      ? `Lectura postventa actual: ${summaryParts.join(" | ")}.`
      : "Sin incidentes postventa relevantes registrados para este producto.";

  const events: SellerPostSaleEvent[] = [
    ...supportTickets
      .filter((ticket) => ticket.status !== "closed")
      .slice(0, 2)
      .map((ticket) => ({
        id: ticket.id,
        kind: "ticket" as const,
        title: ticket.status === "waiting_seller" ? "Ticket esperando seller" : "Ticket abierto",
        summary: ticket.subject,
        tone: eventTone("ticket"),
        at: ticket.last_message_at,
      })),
    ...disputes.slice(0, 2).map((dispute) => ({
      id: dispute.id,
      kind: "dispute" as const,
      title:
        dispute.status === "reviewing"
          ? "Disputa en revision"
          : dispute.status === "resolved"
            ? "Disputa resuelta"
            : dispute.status === "rejected"
              ? "Disputa rechazada"
              : "Disputa abierta",
      summary: dispute.reason,
      tone: eventTone("dispute"),
      at: dispute.updated_at,
    })),
    ...orders
      .filter((order) => order.status === "refunded")
      .slice(0, 2)
      .map((order) => ({
        id: order.id,
        kind: "refund" as const,
        title: "Refund emitido",
        summary: `Pedido #${order.id.slice(0, 8)} marcado como reembolsado.`,
        tone: eventTone("refund"),
        at: order.created_at,
      })),
    ...licenses
      .filter((license) => license.status === "revoked")
      .slice(0, 2)
      .map((license) => ({
        id: license.id,
        kind: "license" as const,
        title: "Licencia revocada",
        summary: `La licencia ${license.id.slice(0, 8)} ya no esta activa para este producto.`,
        tone: eventTone("license"),
        at: license.last_validated_at || new Date().toISOString(),
      })),
    ...riskEvents.slice(0, 2).map((event) => ({
      id: event.id,
      kind: "risk" as const,
      title: event.title,
      summary: `Codigo ${event.code} aun abierto en risk.`,
      tone: eventTone("risk", event.severity),
      at: event.created_at,
    })),
  ]
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .slice(0, 6);

  return {
    metrics,
    nextAction,
    trustSummary,
    events,
  } satisfies SellerPostSaleSnapshot;
}
