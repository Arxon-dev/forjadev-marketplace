import Link from "next/link";
import { notFound } from "next/navigation";
import { DisputeActions } from "@/components/admin/dispute-actions";
import { DisputeRefundAction } from "@/components/admin/dispute-refund-action";
import { RiskSeverityPill } from "@/components/admin/risk-severity-pill";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";
import {
  disputeActorLabel,
  disputeNextActionLabel,
  disputeStatusLabel,
  disputeStatusTone,
  formatProfileLabel,
  getDisputeCaseDetail,
} from "@/lib/disputes/detail";
import { buildRefundResolutionSnapshot } from "@/lib/refunds/post-sale";
import { buildAdminDisputeTriageSnapshot } from "@/lib/risk/admin-dispute-triage";
import {
  getPostSaleGuardrailSnapshot,
  postSaleGuardrailTone,
} from "@/lib/risk/post-sale-guardrails";

interface AdminDisputeDetailPageProps {
  params: Promise<{ disputeId: string }>;
}

function formatCurrency(cents: number) {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

export default async function AdminDisputeDetailPage({ params }: AdminDisputeDetailPageProps) {
  const { disputeId } = await params;
  const { supabase } = await requireAdminContext();
  const disputeCase = await getDisputeCaseDetail(supabase, disputeId);

  if (!disputeCase) {
    notFound();
  }

  const { dispute, product, vendor, order, license, latestSupportTicket, auditLogs, buyerProfile, assignedAdminProfile } =
    disputeCase;
  const guardrails = await getPostSaleGuardrailSnapshot(supabase, {
    buyerUserId: dispute.opened_by_user_id,
    productId: dispute.product_id,
    orderId: dispute.order_id,
    licenseId: dispute.license_id,
    disputeId: dispute.id,
  });
  const refundSnapshot = buildRefundResolutionSnapshot({
    orderStatus: order?.status,
    licenseStatus: license?.status || null,
    supportStatuses: latestSupportTicket ? [latestSupportTicket.status] : [],
    disputeStatuses: [dispute.status],
    productRefundPolicy: product?.refund_policy || null,
  });
  const triage = buildAdminDisputeTriageSnapshot({
    disputeStatus: dispute.status,
    guardrailSeverity: guardrails.overallSeverity,
    latestSupportStatus: latestSupportTicket?.status || null,
    updatedAt: dispute.updated_at,
  });
  const canIssueRefund = Boolean(order?.id) && order?.status !== "refunded" && dispute.status !== "rejected";

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
          <Link href="/admin/risk" className="hover:text-white">
            Risk
          </Link>
          <span>/</span>
          <span className="text-white">Disputa #{dispute.id.slice(0, 8)}</span>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Dispute Ops</p>
              <h1 className="mt-3 text-3xl font-bold text-white">
                {product?.title || "Disputa de compra"}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className={disputeStatusTone(dispute.status)}>
                  {disputeStatusLabel(dispute.status)}
                </Badge>
                <Badge className="border-white/10 bg-white/5 text-[var(--text-soft)]">
                  {disputeActorLabel(dispute.status)}
                </Badge>
                <Badge className={triage.tone}>{triage.label}</Badge>
              </div>

              <div className="mt-5 space-y-3 text-sm text-[var(--text-soft)]">
                <p>
                  Buyer: <span className="text-white">{formatProfileLabel(buyerProfile, dispute.opened_by_user_id)}</span>
                </p>
                <p>
                  Admin asignado:{" "}
                  <span className="text-white">
                    {formatProfileLabel(assignedAdminProfile, "Sin asignar")}
                  </span>
                </p>
                <p>
                  Pedido: <span className="text-white">{order ? `#${order.id.slice(0, 8)}` : "Sin resolver"}</span>
                </p>
                <p>
                  Licencia:{" "}
                  <span className="text-white">
                    {license
                      ? `${license.status === "active" ? "Activa" : "Revocada"} (${license.license_key})`
                      : "Sin licencia vinculada"}
                  </span>
                </p>
                <p>
                  Seller: <span className="text-white">{vendor?.store_name || "Tienda"}</span>
                </p>
                <p>
                  Siguiente accion:{" "}
                  <span className="text-white">{disputeNextActionLabel(dispute.status, "admin")}</span>
                </p>
                <p>
                  Ultima actividad:{" "}
                  <span className="text-white">{new Date(dispute.updated_at).toLocaleString("es-ES")}</span>
                </p>
                <p>
                  Motivo de priorizacion: <span className="text-white">{triage.reason}</span>
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/admin/risk">
                  <Button variant="secondary">Volver a risk</Button>
                </Link>
                {product ? (
                  <Link href={`/admin/products/${product.id}`}>
                    <Button variant="ghost">Ver producto</Button>
                  </Link>
                ) : null}
                {latestSupportTicket ? (
                  <Link href={`/support/tickets/${latestSupportTicket.id}`}>
                    <Button variant="ghost">Ver ticket</Button>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Acciones</h2>
              <div className="mt-4 space-y-4">
                <DisputeActions disputeId={dispute.id} currentStatus={dispute.status} />
                <DisputeRefundAction
                  disputeId={dispute.id}
                  canRefund={canIssueRefund}
                  currentOrderStatus={order?.status || null}
                />
              </div>
              <p className="mt-4 text-xs text-[var(--text-soft)]">
                Guardrail operativo: el refund economico solo puede emitirse cuando el caso ya esta
                en revision y con contexto suficiente para dejar trazabilidad clara.
              </p>
            </div>
          </aside>

          <div className="space-y-6">
            <div className={`rounded-3xl border p-6 ${postSaleGuardrailTone(guardrails.overallSeverity)}`}>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-white">Guardrails postventa</h2>
                {guardrails.overallSeverity ? <RiskSeverityPill severity={guardrails.overallSeverity} /> : null}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-5">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Refunds previos</p>
                  <p className="mt-2 text-2xl font-bold text-white">{guardrails.refundedOrdersCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Disputas</p>
                  <p className="mt-2 text-2xl font-bold text-white">{guardrails.disputeCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Disputas activas</p>
                  <p className="mt-2 text-2xl font-bold text-white">{guardrails.openDisputeCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Licencias revocadas</p>
                  <p className="mt-2 text-2xl font-bold text-white">{guardrails.revokedLicenseCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Eventos/anomalias</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {guardrails.openRiskEventCount + guardrails.anomalyCount}
                  </p>
                </div>
              </div>

              {guardrails.signals.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {guardrails.signals.map((signal) => (
                    <article key={signal.code} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <RiskSeverityPill severity={signal.severity} />
                        <p className="font-semibold text-white">{signal.title}</p>
                      </div>
                      <p className="mt-3 text-sm text-[var(--text-soft)]">{signal.summary}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-[var(--text-soft)]">
                  No hay senales postventa relevantes para este buyer en el contexto actual.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Contexto del caso</h2>
              <div className="mt-4 grid gap-4 text-sm text-[var(--text-soft)] md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Motivo</p>
                  <p className="mt-3 whitespace-pre-wrap">{dispute.reason}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Pedido y licencia</p>
                  <p className="mt-3">
                    {order
                      ? `Compra completada el ${new Date(order.created_at).toLocaleString("es-ES")} por ${formatCurrency(order.total_cents)}.`
                      : "Sin pedido asociado visible."}
                  </p>
                  <p className="mt-2">
                    {license
                      ? `Licencia ${license.status === "active" ? "activa" : "revocada"} y ultima validacion ${license.last_validated_at ? new Date(license.last_validated_at).toLocaleString("es-ES") : "sin registrar"}.`
                      : "Sin licencia asociada."}
                  </p>
                </div>
                <div className={`rounded-2xl border p-4 ${refundSnapshot.tone}`}>
                  <p className="text-xs uppercase tracking-[0.16em]">Resultado postventa</p>
                  <p className="mt-3 text-base font-semibold text-white">{refundSnapshot.label}</p>
                  <p className="mt-3 text-sm">{refundSnapshot.summary}</p>
                  <p className="mt-3 text-sm text-white">{refundSnapshot.nextAction}</p>
                  <p className="mt-3 text-xs text-[var(--text-soft)]">{refundSnapshot.policyHint}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4 md:col-span-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Soporte relacionado</p>
                  {latestSupportTicket ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-white">{latestSupportTicket.subject}</p>
                        <p className="mt-2 text-xs text-[var(--text-soft)]">
                          Estado {latestSupportTicket.status} · Ultimo mensaje {new Date(latestSupportTicket.last_message_at).toLocaleString("es-ES")}
                        </p>
                      </div>
                      <Link href={`/support/tickets/${latestSupportTicket.id}`}>
                        <Button variant="secondary">Abrir ticket</Button>
                      </Link>
                    </div>
                  ) : (
                    <p className="mt-3">No se ha encontrado ticket de soporte relacionado visible.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Timeline del caso</h2>
              {auditLogs.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {auditLogs.map((entry) => (
                    <article key={entry.id} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-white">{entry.action}</p>
                        <p className="text-xs text-[var(--text-soft)]">
                          {new Date(entry.created_at).toLocaleString("es-ES")}
                        </p>
                      </div>
                      <p className="mt-3 text-xs text-[var(--text-soft)]">
                        Actor: {entry.actor_user_id || "Sistema"}
                      </p>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs text-white/80">
                        {entry.metadata ? JSON.stringify(entry.metadata, null, 2) : "Sin metadata"}
                      </pre>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[var(--text-soft)]">No hay eventos de auditoria todavia para este caso.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
