import { createAdminClient } from "@/lib/supabase/admin";

type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";
type DisputeStatus = "open" | "reviewing" | "resolved" | "rejected";

interface ProductAnalyticsDailyRow {
  view_count: number;
  purchase_count: number;
  download_count: number;
  revenue_cents: number;
  add_to_cart_count: number;
}

interface SupportTicketRow {
  status: SupportTicketStatus;
}

interface DisputeRow {
  status: DisputeStatus;
}

interface ProductRiskSnapshotRow {
  risk_score: number;
  open_risk_event_count: number;
  high_risk_event_count: number;
  open_dispute_count: number;
  license_anomaly_count: number;
}

interface CouponRow {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

interface CampaignRow {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export interface ProductHealthSignal {
  label: string;
  value: string;
  tone: string;
}

export interface ProductHealthSnapshot {
  label: string;
  tone: string;
  summary: string;
  nextAction: string;
  metrics: {
    views30d: number;
    addToCarts30d: number;
    purchases30d: number;
    downloads30d: number;
    revenue30dCents: number;
    conversionRate: number;
    openTickets: number;
    waitingSellerTickets: number;
    activeDisputes: number;
    activePromotions: number;
    riskScore: number;
  };
  signals: ProductHealthSignal[];
}

function formatCurrency(cents: number) {
  return cents === 0 ? "EUR 0.00" : `EUR ${(cents / 100).toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function isCurrentlyActive(item: { is_active: boolean; starts_at: string | null; ends_at: string | null }) {
  if (!item.is_active) {
    return false;
  }

  const now = Date.now();
  const startsAt = item.starts_at ? new Date(item.starts_at).getTime() : null;
  const endsAt = item.ends_at ? new Date(item.ends_at).getTime() : null;

  if (startsAt && startsAt > now) {
    return false;
  }

  if (endsAt && endsAt < now) {
    return false;
  }

  return true;
}

export async function getProductHealthSnapshot(productId: string, vendorId: string) {
  const adminSupabase = createAdminClient();
  const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    analyticsResult,
    supportTicketsResult,
    disputesResult,
    couponsResult,
    campaignsResult,
    productRiskResult,
  ] = await Promise.all([
    adminSupabase
      .from("product_analytics_daily")
      .select("view_count, purchase_count, download_count, revenue_cents, add_to_cart_count")
      .eq("product_id", productId)
      .gte("day", since),
    adminSupabase
      .from("support_tickets")
      .select("status")
      .eq("product_id", productId)
      .eq("vendor_id", vendorId),
    adminSupabase
      .from("disputes")
      .select("status")
      .eq("product_id", productId),
    adminSupabase
      .from("coupons")
      .select("is_active, starts_at, ends_at")
      .eq("product_id", productId),
    adminSupabase
      .from("campaigns")
      .select("is_active, starts_at, ends_at")
      .eq("product_id", productId),
    adminSupabase
      .from("product_risk_snapshots")
      .select("risk_score, open_risk_event_count, high_risk_event_count, open_dispute_count, license_anomaly_count")
      .eq("product_id", productId)
      .maybeSingle(),
  ]);

  const analyticsRows = (analyticsResult.data || []) as ProductAnalyticsDailyRow[];
  const supportTickets = (supportTicketsResult.data || []) as SupportTicketRow[];
  const disputes = (disputesResult.data || []) as DisputeRow[];
  const coupons = (couponsResult.data || []) as CouponRow[];
  const campaigns = (campaignsResult.data || []) as CampaignRow[];
  const productRisk = (productRiskResult.data || null) as ProductRiskSnapshotRow | null;

  const metrics = analyticsRows.reduce(
    (accumulator, row) => {
      accumulator.views30d += row.view_count || 0;
      accumulator.addToCarts30d += row.add_to_cart_count || 0;
      accumulator.purchases30d += row.purchase_count || 0;
      accumulator.downloads30d += row.download_count || 0;
      accumulator.revenue30dCents += row.revenue_cents || 0;
      return accumulator;
    },
    {
      views30d: 0,
      addToCarts30d: 0,
      purchases30d: 0,
      downloads30d: 0,
      revenue30dCents: 0,
      conversionRate: 0,
      openTickets: supportTickets.filter((ticket) => ticket.status !== "closed").length,
      waitingSellerTickets: supportTickets.filter((ticket) => ticket.status === "waiting_seller").length,
      activeDisputes: disputes.filter((dispute) => dispute.status === "open" || dispute.status === "reviewing").length,
      activePromotions:
        coupons.filter((coupon) => isCurrentlyActive(coupon)).length +
        campaigns.filter((campaign) => isCurrentlyActive(campaign)).length,
      riskScore: productRisk?.risk_score || 0,
    }
  );

  metrics.conversionRate = metrics.views30d > 0 ? (metrics.purchases30d / metrics.views30d) * 100 : 0;

  let label = "Salud comercial estable";
  let tone = "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  let summary =
    "La lectura actual combina traccion, conversion y friccion post-sale sin alertas operativas fuertes.";
  let nextAction = "Mantener la promesa comercial del producto, revisar conversion y seguir impulsando discovery.";

  if (metrics.waitingSellerTickets > 0) {
    label = "Atencion operativa inmediata";
    tone = "border-amber-500/30 bg-amber-500/10 text-amber-200";
    summary = "Hay soporte esperando respuesta del seller y eso ya afecta la salud operativa del producto.";
    nextAction = `Responder ${metrics.waitingSellerTickets} ticket(s) que siguen esperando al seller antes de que aumente la friccion.`;
  } else if (metrics.activeDisputes > 0 || (productRisk?.high_risk_event_count || 0) > 0) {
    label = "Riesgo y friccion comercial";
    tone = "border-rose-500/30 bg-rose-500/10 text-rose-200";
    summary = "El producto ya muestra senales de friccion post-sale o riesgo abierto que requieren revision prioritaria.";
    nextAction =
      "Revisar soporte, disputa y promesa del producto para corregir la causa de la friccion antes de escalar mas casos.";
  } else if (metrics.views30d >= 40 && metrics.purchases30d === 0) {
    label = "Interes sin conversion";
    tone = "border-sky-500/30 bg-sky-500/10 text-sky-200";
    summary = "El producto esta recibiendo trafico, pero no lo convierte en compras dentro de la ventana reciente.";
    nextAction =
      "Revisar propuesta comercial, precio, creatives y clarity de ficha porque la demanda aun no se traduce en compra.";
  } else if (metrics.activePromotions > 0 && metrics.purchases30d <= 1 && metrics.views30d > 0) {
    label = "Promocion con respuesta debil";
    tone = "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200";
    summary = "Hay merchandising activo, pero la respuesta comercial sigue siendo floja para el alcance reciente.";
    nextAction =
      "Revisar si la campaña o cupon realmente esta alineado con el producto y si la ficha comunica bien el valor del deal.";
  } else if (metrics.views30d < 20) {
    label = "Baja traccion reciente";
    tone = "border-white/10 bg-white/5 text-[var(--text-soft)]";
    summary = "La salud operativa es correcta, pero la traccion comercial reciente sigue siendo limitada.";
    nextAction =
      "Empujar discovery y campaigns del producto si quieres acelerar crecimiento sin tocar aun la operacion post-sale.";
  }

  const signals: ProductHealthSignal[] = [
    {
      label: "Conversion 30d",
      value: formatPercent(metrics.conversionRate),
      tone: metrics.conversionRate >= 3 ? "text-emerald-200" : "text-[var(--text-soft)]",
    },
    {
      label: "Ingresos 30d",
      value: formatCurrency(metrics.revenue30dCents),
      tone: "text-white",
    },
    {
      label: "Tickets abiertos",
      value: String(metrics.openTickets),
      tone: metrics.openTickets > 0 ? "text-amber-200" : "text-[var(--text-soft)]",
    },
    {
      label: "Disputas activas",
      value: String(metrics.activeDisputes),
      tone: metrics.activeDisputes > 0 ? "text-rose-200" : "text-[var(--text-soft)]",
    },
    {
      label: "Promos activas",
      value: String(metrics.activePromotions),
      tone: metrics.activePromotions > 0 ? "text-sky-200" : "text-[var(--text-soft)]",
    },
    {
      label: "Risk score",
      value: String(metrics.riskScore),
      tone: metrics.riskScore >= 60 ? "text-rose-200" : "text-[var(--text-soft)]",
    },
  ];

  if ((productRisk?.open_risk_event_count || 0) > 0) {
    signals.push({
      label: "Eventos abiertos",
      value: String(productRisk?.open_risk_event_count || 0),
      tone: "text-amber-200",
    });
  }

  if ((productRisk?.license_anomaly_count || 0) > 0) {
    signals.push({
      label: "Anomalias",
      value: String(productRisk?.license_anomaly_count || 0),
      tone: "text-rose-200",
    });
  }

  return {
    label,
    tone,
    summary,
    nextAction,
    metrics,
    signals,
  } satisfies ProductHealthSnapshot;
}
