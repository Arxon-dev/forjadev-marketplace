import Link from "next/link";
import { DisputeActions } from "@/components/admin/dispute-actions";
import { RiskEventActions } from "@/components/admin/risk-event-actions";
import { RiskScoreMeter } from "@/components/admin/risk-score-meter";
import { RiskSeverityPill } from "@/components/admin/risk-severity-pill";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";
import {
  disputeNextActionLabel,
  formatProfileLabel,
  getDisputeCaseDetail,
} from "@/lib/disputes/detail";
import { buildAdminDisputeTriageSnapshot } from "@/lib/risk/admin-dispute-triage";
import { getPostSaleGuardrailSnapshot } from "@/lib/risk/post-sale-guardrails";

type RiskEventRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  vendor_id: string | null;
  user_id: string | null;
  severity: "low" | "medium" | "high";
  code: string;
  title: string;
  details: string | null;
  status: "open" | "resolved" | "ignored";
  created_at: string;
};

type ModerationFlagRow = {
  id: string;
  product_id: string;
  flag_code: string;
  severity: "low" | "medium" | "high";
  reason: string;
  is_active: boolean;
  created_at: string;
};

type LicenseAnomalyRow = {
  id: string;
  license_id: string | null;
  product_id: string;
  user_id: string;
  anomaly_code: string;
  severity: "low" | "medium" | "high";
  details: string | null;
  created_at: string;
};

type DisputeRow = {
  id: string;
  order_id: string | null;
  license_id: string | null;
  product_id: string | null;
  opened_by_user_id: string;
  assigned_admin_user_id: string | null;
  status: "open" | "reviewing" | "resolved" | "rejected";
  reason: string;
  created_at: string;
  updated_at: string;
};

type ProductRow = {
  id: string;
  title: string;
  slug: string;
  vendor_id: string;
};

type VendorRow = {
  id: string;
  store_name: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
};

type ProductRiskSnapshotRow = {
  product_id: string;
  vendor_id: string;
  risk_score: number;
  updated_at: string;
};

type SellerRiskSnapshotRow = {
  vendor_id: string;
  risk_score: number;
  flagged_product_count: number;
  open_dispute_count: number;
  open_risk_event_count: number;
  updated_at: string;
};

export default async function AdminRiskPage() {
  const { supabase } = await requireAdminContext();

  const [riskEventsResult, moderationFlagsResult, anomaliesResult, disputesResult, productRiskResult, sellerRiskResult] = await Promise.all([
    supabase
      .from("risk_events")
      .select("id, entity_type, entity_id, vendor_id, user_id, severity, code, title, details, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("moderation_flags")
      .select("id, product_id, flag_code, severity, reason, is_active, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("license_anomalies")
      .select("id, license_id, product_id, user_id, anomaly_code, severity, details, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("disputes")
      .select("id, order_id, license_id, product_id, opened_by_user_id, assigned_admin_user_id, status, reason, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("product_risk_snapshots")
      .select("product_id, vendor_id, risk_score, updated_at")
      .order("risk_score", { ascending: false })
      .limit(10),
    supabase
      .from("seller_risk_snapshots")
      .select("vendor_id, risk_score, flagged_product_count, open_dispute_count, open_risk_event_count, updated_at")
      .order("risk_score", { ascending: false })
      .limit(10),
  ]);

  const riskEvents = (riskEventsResult.data || []) as RiskEventRow[];
  const moderationFlags = (moderationFlagsResult.data || []) as ModerationFlagRow[];
  const anomalies = (anomaliesResult.data || []) as LicenseAnomalyRow[];
  const disputes = (disputesResult.data || []) as DisputeRow[];
  const productRiskSnapshots = (productRiskResult.data || []) as ProductRiskSnapshotRow[];
  const sellerRiskSnapshots = (sellerRiskResult.data || []) as SellerRiskSnapshotRow[];

  const productIds = Array.from(
    new Set([
      ...riskEvents
        .filter((event) => event.entity_type === "product")
        .map((event) => event.entity_id),
      ...moderationFlags.map((flag) => flag.product_id),
      ...anomalies.map((anomaly) => anomaly.product_id),
      ...(disputes.map((dispute) => dispute.product_id).filter(Boolean) as string[]),
      ...productRiskSnapshots.map((snapshot) => snapshot.product_id),
    ])
  );
  const vendorIds = Array.from(
    new Set([
      ...riskEvents.map((event) => event.vendor_id).filter(Boolean),
      ...productRiskSnapshots.map((snapshot) => snapshot.vendor_id),
      ...sellerRiskSnapshots.map((snapshot) => snapshot.vendor_id),
    ] as string[])
  );
  const userIds = Array.from(
    new Set([
      ...riskEvents.map((event) => event.user_id).filter(Boolean),
      ...anomalies.map((anomaly) => anomaly.user_id),
      ...disputes.map((dispute) => dispute.opened_by_user_id),
      ...disputes.map((dispute) => dispute.assigned_admin_user_id).filter(Boolean),
    ] as string[])
  );

  const [productsResult, vendorsResult, profilesResult] = await Promise.all([
    productIds.length > 0
      ? supabase.from("products").select("id, title, slug, vendor_id").in("id", productIds)
      : Promise.resolve({ data: [] as ProductRow[] }),
    vendorIds.length > 0
      ? supabase.from("vendors").select("id, store_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as VendorRow[] }),
    userIds.length > 0
      ? supabase.from("profiles").select("id, display_name, username, email").in("id", userIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
  ]);

  const productById = new Map(((productsResult.data || []) as ProductRow[]).map((item) => [item.id, item]));
  const vendorById = new Map(((vendorsResult.data || []) as VendorRow[]).map((item) => [item.id, item]));
  const profileById = new Map(((profilesResult.data || []) as ProfileRow[]).map((item) => [item.id, item]));

  const openRiskCount = riskEvents.filter((event) => event.status === "open").length;
  const highRiskCount = riskEvents.filter((event) => event.severity === "high").length;
  const activeModerationFlagCount = moderationFlags.length;
  const openDisputeCount = disputes.filter((dispute) => ["open", "reviewing"].includes(dispute.status)).length;
  const activeDisputes = disputes.filter((dispute) => dispute.status === "open" || dispute.status === "reviewing");
  const triageEntries = await Promise.all(
    activeDisputes.map(async (dispute) => {
      const detail = await getDisputeCaseDetail(supabase, dispute.id);
      const guardrails = await getPostSaleGuardrailSnapshot(supabase, {
        buyerUserId: dispute.opened_by_user_id,
        productId: dispute.product_id,
        orderId: dispute.order_id,
        licenseId: dispute.license_id,
        disputeId: dispute.id,
      });
      const triage = buildAdminDisputeTriageSnapshot({
        disputeStatus: dispute.status,
        guardrailSeverity: guardrails.overallSeverity,
        latestSupportStatus: detail?.latestSupportTicket?.status || null,
        updatedAt: dispute.updated_at,
      });

      return {
        dispute,
        detail,
        guardrails,
        triage,
      };
    })
  );
  triageEntries.sort((left, right) => {
    if (right.triage.score !== left.triage.score) {
      return right.triage.score - left.triage.score;
    }

    return new Date(left.dispute.updated_at).getTime() - new Date(right.dispute.updated_at).getTime();
  });

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Admin</p>
            <h1 className="mt-3 text-4xl font-bold text-white">Risk intelligence</h1>
            <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
              Senales operativas para priorizar moderacion, detectar abuso de licencias y reducir fraude sin volar a ciegas.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="secondary">Volver a moderacion</Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Eventos abiertos</p>
            <p className="mt-2 text-3xl font-bold text-white">{openRiskCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Alta severidad</p>
            <p className="mt-2 text-3xl font-bold text-white">{highRiskCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Flags activos</p>
            <p className="mt-2 text-3xl font-bold text-white">{activeModerationFlagCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Disputas abiertas</p>
            <p className="mt-2 text-3xl font-bold text-white">{openDisputeCount}</p>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Triage operativo de disputas</h2>
              <p className="mt-2 max-w-3xl text-sm text-[var(--text-soft)]">
                Esta cola ordena primero los casos que ya piden decision administrativa clara, mas contexto de riesgo o menos margen para esperar.
              </p>
            </div>
          </div>

          {triageEntries.length > 0 ? (
            <div className="mt-5 space-y-4">
              {triageEntries.map(({ dispute, detail, guardrails, triage }) => {
                const product =
                  detail?.product ||
                  (dispute.product_id ? productById.get(dispute.product_id) || null : null);
                const buyer =
                  detail?.buyerProfile || profileById.get(dispute.opened_by_user_id) || null;

                return (
                  <article
                    key={dispute.id}
                    data-admin-triage-level={triage.priority}
                    className="rounded-2xl border border-white/10 bg-black/10 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${triage.tone}`}>
                            {triage.label}
                          </span>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                            {dispute.status}
                          </span>
                          {product ? (
                            <span className="text-xs text-[var(--text-soft)]">{product.title}</span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm font-semibold text-white">
                          {formatProfileLabel(buyer, dispute.opened_by_user_id)}
                        </p>
                        <p className="mt-2 text-sm text-[var(--text-soft)]">{triage.reason}</p>
                        <p className="mt-2 text-sm text-[var(--text-soft)]">
                          Siguiente accion:{" "}
                          <span className="text-white">{disputeNextActionLabel(dispute.status, "admin")}</span>
                        </p>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-soft)]">
                          <span>Refunds previos: {guardrails.refundedOrdersCount}</span>
                          <span>Disputas activas: {guardrails.openDisputeCount}</span>
                          <span>Licencias revocadas: {guardrails.revokedLicenseCount}</span>
                          <span>Eventos/anomalias: {guardrails.openRiskEventCount + guardrails.anomalyCount}</span>
                        </div>
                      </div>

                      <div className="flex min-w-[220px] flex-wrap gap-3">
                        <Link href={`/admin/disputes/${dispute.id}`}>
                          <Button variant="secondary">Abrir caso</Button>
                        </Link>
                        {detail?.latestSupportTicket ? (
                          <Link href={`/support/tickets/${detail.latestSupportTicket.id}`}>
                            <Button variant="ghost">Ver ticket</Button>
                          </Link>
                        ) : null}
                        {product ? (
                          <Link href={`/admin/products/${product.id}`}>
                            <Button variant="ghost">Ver producto</Button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 px-6 py-10 text-center">
              <p className="text-[var(--text-soft)]">No hay disputas activas que requieran triage ahora mismo.</p>
            </div>
          )}
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Eventos de riesgo recientes</h2>
            {riskEvents.length > 0 ? (
              <div className="mt-5 space-y-4">
                {riskEvents.map((event) => {
                  const product =
                    event.entity_type === "product" ? productById.get(event.entity_id) : null;
                  const vendor = event.vendor_id ? vendorById.get(event.vendor_id) : null;
                  const profile = event.user_id ? profileById.get(event.user_id) : null;

                  return (
                    <article key={event.id} className="rounded-2xl border border-white/10 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <RiskSeverityPill severity={event.severity} />
                            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                              {event.status}
                            </span>
                          </div>
                          <h3 className="mt-3 text-lg font-semibold text-white">{event.title}</h3>
                          <p className="mt-2 text-sm text-[var(--text-soft)]">
                            {event.details || "Sin detalles adicionales."}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-soft)]">
                            <span>Codigo: {event.code}</span>
                            <span>Entidad: {event.entity_type}</span>
                            {vendor ? <span>Seller: {vendor.store_name}</span> : null}
                            {profile ? (
                              <span>
                                Usuario: {profile.display_name || profile.username || profile.email}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {product?.slug ? (
                          <Link href={`/admin/products/${product.id}`}>
                            <Button variant="secondary">Revisar</Button>
                          </Link>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        <RiskEventActions riskEventId={event.id} currentStatus={event.status} />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center">
                <p className="text-[var(--text-soft)]">No hay eventos de riesgo todavia.</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Disputas recientes</h2>
              {disputes.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {disputes.map((dispute) => {
                    const product = dispute.product_id ? productById.get(dispute.product_id) : null;
                    const buyer = profileById.get(dispute.opened_by_user_id);
                    const assignedAdmin = dispute.assigned_admin_user_id
                      ? profileById.get(dispute.assigned_admin_user_id)
                      : null;

                    return (
                      <article key={dispute.id} className="rounded-2xl border border-white/10 p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                            {dispute.status}
                          </span>
                          {product ? (
                            <span className="text-xs text-[var(--text-soft)]">{product.title}</span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm text-[var(--text-soft)]">{dispute.reason}</p>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-soft)]">
                          {buyer ? (
                            <span>
                              Buyer: {buyer.display_name || buyer.username || buyer.email}
                            </span>
                          ) : null}
                          {assignedAdmin ? (
                            <span>
                              Asignado a: {assignedAdmin.display_name || assignedAdmin.username || assignedAdmin.email}
                            </span>
                          ) : (
                            <span>Sin admin asignado</span>
                          )}
                        </div>
                        <div className="mt-4">
                          <DisputeActions disputeId={dispute.id} currentStatus={dispute.status} />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link href={`/admin/disputes/${dispute.id}`}>
                            <Button variant="secondary">Abrir caso</Button>
                          </Link>
                          {product ? (
                            <Link href={`/admin/products/${product.id}`}>
                              <Button variant="ghost">Ver producto</Button>
                            </Link>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-[var(--text-soft)]">Sin disputas registradas.</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Top productos por riesgo</h2>
              {productRiskSnapshots.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {productRiskSnapshots.map((snapshot) => {
                    const product = productById.get(snapshot.product_id);

                    return (
                      <article key={snapshot.product_id} className="rounded-2xl border border-white/10 p-4">
                        <p className="font-semibold text-white">{product?.title || "Producto"}</p>
                        <div className="mt-3">
                          <RiskScoreMeter score={snapshot.risk_score} compact />
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-[var(--text-soft)]">Sin snapshots de producto todavia.</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Top sellers por riesgo</h2>
              {sellerRiskSnapshots.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {sellerRiskSnapshots.map((snapshot) => {
                    const vendor = vendorById.get(snapshot.vendor_id);

                    return (
                      <article key={snapshot.vendor_id} className="rounded-2xl border border-white/10 p-4">
                        <p className="font-semibold text-white">{vendor?.store_name || "Tienda"}</p>
                        <div className="mt-3">
                          <RiskScoreMeter score={snapshot.risk_score} compact />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-soft)]">
                          <span>Flags: {snapshot.flagged_product_count}</span>
                          <span>Eventos abiertos: {snapshot.open_risk_event_count}</span>
                          <span>Disputas abiertas: {snapshot.open_dispute_count}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-[var(--text-soft)]">Sin snapshots de seller todavia.</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Flags de moderacion</h2>
              {moderationFlags.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {moderationFlags.map((flag) => {
                    const product = productById.get(flag.product_id);

                    return (
                      <article key={flag.id} className="rounded-2xl border border-white/10 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <RiskSeverityPill severity={flag.severity} />
                            <h3 className="mt-3 font-semibold text-white">
                              {product?.title || "Producto"}
                            </h3>
                            <p className="mt-2 text-sm text-[var(--text-soft)]">{flag.reason}</p>
                          </div>
                          {product ? (
                            <Link href={`/admin/products/${product.id}`} className="text-sm text-white hover:underline">
                              Abrir
                            </Link>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-[var(--text-soft)]">No hay flags activos.</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Anomalias de licencia</h2>
              {anomalies.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {anomalies.map((anomaly) => {
                    const product = productById.get(anomaly.product_id);
                    const profile = profileById.get(anomaly.user_id);

                    return (
                      <article key={anomaly.id} className="rounded-2xl border border-white/10 p-4">
                        <RiskSeverityPill severity={anomaly.severity} />
                        <h3 className="mt-3 font-semibold text-white">{anomaly.anomaly_code}</h3>
                        <p className="mt-2 text-sm text-[var(--text-soft)]">
                          {anomaly.details || "Sin detalle adicional."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-soft)]">
                          {product ? <span>Producto: {product.title}</span> : null}
                          {profile ? (
                            <span>
                              Usuario: {profile.display_name || profile.username || profile.email}
                            </span>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-[var(--text-soft)]">Sin anomalias registradas.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
