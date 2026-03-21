export type GuardrailSeverity = "low" | "medium" | "high";

interface GuardrailInput {
  buyerUserId: string;
  productId: string | null;
  orderId: string | null;
  licenseId: string | null;
  disputeId?: string | null;
}

interface OrderRiskRow {
  id: string;
  status: "pending" | "completed" | "failed" | "refunded";
}

interface DisputeRiskRow {
  id: string;
  status: "open" | "reviewing" | "resolved" | "rejected";
}

interface LicenseRiskRow {
  id: string;
  status: "active" | "revoked";
}

interface LicenseAnomalyRiskRow {
  id: string;
  anomaly_code: string;
  severity: GuardrailSeverity;
  details: string | null;
  created_at: string;
}

interface RiskEventRow {
  id: string;
  code: string;
  severity: GuardrailSeverity;
  status: "open" | "resolved" | "ignored";
  title: string;
  created_at: string;
}

export interface PostSaleGuardrailSignal {
  code:
    | "repeat_refunds"
    | "repeat_disputes"
    | "revoked_license_history"
    | "linked_license_anomaly"
    | "open_risk_events";
  severity: GuardrailSeverity;
  title: string;
  summary: string;
}

export interface PostSaleGuardrailSnapshot {
  refundedOrdersCount: number;
  disputeCount: number;
  openDisputeCount: number;
  revokedLicenseCount: number;
  anomalyCount: number;
  openRiskEventCount: number;
  overallSeverity: GuardrailSeverity | null;
  signals: PostSaleGuardrailSignal[];
}

function severityWeight(severity: GuardrailSeverity) {
  return severity === "high" ? 3 : severity === "medium" ? 2 : 1;
}

export function postSaleGuardrailTone(severity: GuardrailSeverity | null) {
  if (severity === "high") {
    return "border-red-500/30 bg-red-500/10 text-red-100";
  }

  if (severity === "medium") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }

  if (severity === "low") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-100";
  }

  return "border-white/10 bg-white/5 text-[var(--text-soft)]";
}

export async function getPostSaleGuardrailSnapshot(
  supabase: {
    from: (table: string) => any;
  },
  { buyerUserId, productId, orderId, licenseId, disputeId = null }: GuardrailInput
): Promise<PostSaleGuardrailSnapshot> {
  const [ordersResult, disputesResult, licensesResult, anomalyResult, riskEventsResult] = await Promise.all([
    (supabase
      .from("orders")
      .select("id, status")
      .eq("user_id", buyerUserId)
      .in("status", ["completed", "refunded"])
      .order("created_at", { ascending: false })) as Promise<{ data: OrderRiskRow[] | null }>,
    (supabase
      .from("disputes")
      .select("id, status")
      .eq("opened_by_user_id", buyerUserId)
      .order("created_at", { ascending: false })) as Promise<{ data: DisputeRiskRow[] | null }>,
    (supabase
      .from("licenses")
      .select("id, status")
      .eq("user_id", buyerUserId)
      .order("issued_at", { ascending: false })) as Promise<{ data: LicenseRiskRow[] | null }>,
    productId
      ? ((supabase
          .from("license_anomalies")
          .select("id, anomaly_code, severity, details, created_at")
          .eq("user_id", buyerUserId)
          .eq("product_id", productId)
          .order("created_at", { ascending: false })
          .limit(5)) as Promise<{ data: LicenseAnomalyRiskRow[] | null }>)
      : Promise.resolve({ data: [] as LicenseAnomalyRiskRow[] }),
    ((supabase
      .from("risk_events")
      .select("id, code, severity, status, title, created_at")
      .eq("user_id", buyerUserId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(5)) as Promise<{ data: RiskEventRow[] | null }>),
  ]);

  const orders = ordersResult.data || [];
  const disputes = disputesResult.data || [];
  const licenses = licensesResult.data || [];
  const anomalies = anomalyResult.data || [];
  const openRiskEvents = riskEventsResult.data || [];

  const refundedOrdersCount = orders.filter((order) => order.status === "refunded").length;
  const revokedLicenseCount = licenses.filter((license) => license.status === "revoked").length;
  const openDisputeCount = disputes.filter((dispute) => dispute.status === "open" || dispute.status === "reviewing").length;
  const disputeCount = disputes.length;

  const signals: PostSaleGuardrailSignal[] = [];

  if (refundedOrdersCount >= 2) {
    signals.push({
      code: "repeat_refunds",
      severity: refundedOrdersCount >= 3 ? "high" : "medium",
      title: "Historial repetido de reembolsos",
      summary: `Este buyer ya acumula ${refundedOrdersCount} pedidos reembolsados. Conviene revisar el patron antes de conceder otra salida economica.`,
    });
  }

  if (disputeCount >= 2) {
    signals.push({
      code: "repeat_disputes",
      severity: openDisputeCount >= 2 ? "high" : "medium",
      title: "Historial repetido de disputas",
      summary: `El buyer ya acumula ${disputeCount} disputas registradas (${openDisputeCount} activas).`,
    });
  }

  if (revokedLicenseCount >= 2) {
    signals.push({
      code: "revoked_license_history",
      severity: revokedLicenseCount >= 3 ? "high" : "medium",
      title: "Licencias revocadas en el historial",
      summary: `Hay ${revokedLicenseCount} licencias revocadas vinculadas a este buyer. Revisa si el patron es coherente con los casos previos.`,
    });
  }

  if (anomalies.length > 0) {
    const topSeverity = [...anomalies]
      .sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity))[0]?.severity || "medium";

    signals.push({
      code: "linked_license_anomaly",
      severity: topSeverity,
      title: "Anomalias de licencia en el mismo producto",
      summary: `Existen ${anomalies.length} anomalias registradas para este buyer y producto. La mas reciente es ${anomalies[0].anomaly_code}.`,
    });
  }

  if (openRiskEvents.length > 0) {
    const topSeverity = [...openRiskEvents]
      .sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity))[0]?.severity || "medium";

    signals.push({
      code: "open_risk_events",
      severity: topSeverity,
      title: "Eventos de riesgo abiertos para el buyer",
      summary: `Hay ${openRiskEvents.length} eventos de riesgo abiertos que conviene revisar antes de resolver este caso.`,
    });
  }

  const overallSeverity =
    signals.length > 0
      ? [...signals].sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity))[0].severity
      : null;

  return {
    refundedOrdersCount,
    disputeCount,
    openDisputeCount,
    revokedLicenseCount,
    anomalyCount: anomalies.length,
    openRiskEventCount: openRiskEvents.length,
    overallSeverity,
    signals,
  };
}

export function summarizePostSaleGuardrails(snapshot: PostSaleGuardrailSnapshot) {
  if (snapshot.signals.length === 0) {
    return "Sin senales postventa relevantes registradas para este buyer.";
  }

  return snapshot.signals.map((signal) => `${signal.title}: ${signal.summary}`).join(" ");
}
