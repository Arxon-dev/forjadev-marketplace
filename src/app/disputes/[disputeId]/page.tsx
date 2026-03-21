import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { BuyerPostSaleClarityCard } from "@/components/post-sale/buyer-post-sale-clarity-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  disputeActorLabel,
  disputeNextActionLabel,
  disputeStatusLabel,
  disputeStatusTone,
  formatProfileLabel,
  getBuyerDisputeCaseDetail,
} from "@/lib/disputes/detail";
import { buildBuyerPostSaleTransparencySnapshot } from "@/lib/post-sale/buyer-transparency";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface DisputeDetailPageProps {
  params: Promise<{ disputeId: string }>;
}

function formatCurrency(cents: number) {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

export default async function DisputeDetailPage({ params }: DisputeDetailPageProps) {
  const { disputeId } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const disputeCase = await getBuyerDisputeCaseDetail(adminSupabase, disputeId, user.id);

  if (!disputeCase) {
    notFound();
  }

  const { dispute, product, vendor, order, license, latestSupportTicket, auditLogs, assignedAdminProfile } =
    disputeCase;
  const transparencySnapshot = buildBuyerPostSaleTransparencySnapshot({
    orderStatus: order?.status,
    accessOk: license?.status === "active",
    accessMessage:
      license?.status === "revoked"
        ? "Licencia revocada"
        : order?.id
          ? "Compra registrada"
          : "Compra no resuelta",
    licenseStatus: license?.status || null,
    supportStatuses: latestSupportTicket ? [latestSupportTicket.status] : [],
    disputeStatuses: [dispute.status],
    productRefundPolicy: product?.refund_policy || null,
  });

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
          <Link href="/disputes" className="hover:text-white">
            Disputas
          </Link>
          <span>/</span>
          <span className="text-white">Caso #{dispute.id.slice(0, 8)}</span>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Caso</p>
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
              </div>

              <div className="mt-5 space-y-3 text-sm text-[var(--text-soft)]">
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
                  Admin asignado:{" "}
                  <span className="text-white">
                    {formatProfileLabel(assignedAdminProfile, "Pendiente de asignacion")}
                  </span>
                </p>
                <p>
                  Abierta: <span className="text-white">{new Date(dispute.created_at).toLocaleString("es-ES")}</span>
                </p>
                <p>
                  Ultima actividad:{" "}
                  <span className="text-white">{new Date(dispute.updated_at).toLocaleString("es-ES")}</span>
                </p>
                <p>
                  Siguiente accion:{" "}
                  <span className="text-white">{disputeNextActionLabel(dispute.status, "buyer")}</span>
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/disputes">
                  <Button variant="secondary">Volver a disputas</Button>
                </Link>
                {order ? (
                  <Link href={`/orders?highlightOrder=${order.id}`}>
                    <Button variant="ghost">Ver pedido</Button>
                  </Link>
                ) : null}
                {product?.slug ? (
                  <Link href={`/products/${product.slug}`}>
                    <Button variant="ghost">Ver producto</Button>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Contexto operativo</h2>
              <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
                <p>
                  {order
                    ? `La compra asociada se completo el ${new Date(order.created_at).toLocaleString("es-ES")} por ${formatCurrency(order.total_cents)}.`
                    : "No se ha podido resolver un pedido asociado a esta disputa."}
                </p>
                <p>
                  {license
                    ? `La licencia vinculada esta ${license.status === "active" ? "activa" : "revocada"}.`
                    : "Esta disputa no depende de una licencia emitida individualmente."}
                </p>
                <p>{latestSupportTicket ? "Existe un ticket de soporte relacionado para este producto." : "No se ha localizado un ticket de soporte relacionado visible."}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {latestSupportTicket ? (
                  <Link href={`/support/tickets/${latestSupportTicket.id}`}>
                    <Button variant="secondary">Ver ticket relacionado</Button>
                  </Link>
                ) : (
                  product?.id ? (
                    <Link href={`/support?product=${product.id}`}>
                      <Button variant="secondary">Abrir soporte</Button>
                    </Link>
                  ) : null
                )}
                <Link href="/support?view=buyer">
                  <Button variant="ghost">Centro de soporte</Button>
                </Link>
                <Link href="/policies/reembolsos-y-reclamaciones">
                  <Button variant="ghost">Policy de reembolsos</Button>
                </Link>
              </div>
            </div>

            <BuyerPostSaleClarityCard snapshot={transparencySnapshot} />
          </aside>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Motivo de la disputa</h2>
              <p className="mt-4 whitespace-pre-wrap text-[var(--text-soft)]">{dispute.reason}</p>
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
                <p className="mt-4 text-[var(--text-soft)]">Aun no hay eventos registrados para esta disputa.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
