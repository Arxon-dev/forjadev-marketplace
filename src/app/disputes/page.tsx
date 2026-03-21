import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { BuyerPostSaleClarityCard } from "@/components/post-sale/buyer-post-sale-clarity-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  disputeActorLabel,
  disputeNextActionLabel,
  disputeStatusLabel,
  disputeStatusTone,
  type DisputeCaseRecord,
} from "@/lib/disputes/detail";
import { buildBuyerPostSaleTransparencySnapshot } from "@/lib/post-sale/buyer-transparency";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface ProductRow {
  id: string;
  title: string;
  slug: string;
  refund_policy: string | null;
}

interface SupportTicketRow {
  id: string;
  product_id: string;
  status: "open" | "waiting_seller" | "waiting_buyer" | "closed";
  last_message_at: string;
}

interface OrderRow {
  id: string;
  status: string;
}

interface LicenseRow {
  id: string;
  status: "active" | "revoked";
}

export default async function DisputesPage() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: disputes } = await adminSupabase
    .from("disputes")
    .select(
      "id, order_id, product_id, license_id, opened_by_user_id, assigned_admin_user_id, status, reason, created_at, updated_at"
    )
    .eq("opened_by_user_id", user.id)
    .order("updated_at", { ascending: false });

  const disputeRows = (disputes || []) as DisputeCaseRecord[];
  const productIds = Array.from(
    new Set(disputeRows.map((dispute) => dispute.product_id).filter(Boolean) as string[])
  );
  const adminIds = Array.from(
    new Set(disputeRows.map((dispute) => dispute.assigned_admin_user_id).filter(Boolean) as string[])
  );
  const orderIds = Array.from(new Set(disputeRows.map((dispute) => dispute.order_id).filter(Boolean) as string[]));
  const licenseIds = Array.from(
    new Set(disputeRows.map((dispute) => dispute.license_id).filter(Boolean) as string[])
  );

  const [productsResult, adminsResult, supportTicketsResult, ordersResult, licensesResult] = await Promise.all([
    productIds.length
      ? adminSupabase.from("products").select("id, title, slug, refund_policy").in("id", productIds)
      : Promise.resolve({ data: [] as ProductRow[] }),
    adminIds.length
      ? adminSupabase.from("profiles").select("id, display_name, username, email").in("id", adminIds)
      : Promise.resolve({ data: [] as Array<{ id: string; display_name: string | null; username: string | null; email: string | null }> }),
    productIds.length
      ? adminSupabase
          .from("support_tickets")
          .select("id, product_id, status, last_message_at")
          .eq("buyer_user_id", user.id)
          .in("product_id", productIds)
          .order("last_message_at", { ascending: false })
      : Promise.resolve({ data: [] as SupportTicketRow[] }),
    orderIds.length
      ? adminSupabase.from("orders").select("id, status").in("id", orderIds)
      : Promise.resolve({ data: [] as OrderRow[] }),
    licenseIds.length
      ? adminSupabase.from("licenses").select("id, status").in("id", licenseIds)
      : Promise.resolve({ data: [] as LicenseRow[] }),
  ]);

  const productById = new Map(((productsResult.data || []) as ProductRow[]).map((product) => [product.id, product]));
  const adminById = new Map(
    ((adminsResult.data || []) as Array<{ id: string; display_name: string | null; username: string | null; email: string | null }>).map(
      (profile) => [profile.id, profile]
    )
  );
  const latestTicketByProductId = new Map<string, SupportTicketRow>();
  ((supportTicketsResult.data || []) as SupportTicketRow[]).forEach((ticket) => {
    if (!latestTicketByProductId.has(ticket.product_id)) {
      latestTicketByProductId.set(ticket.product_id, ticket);
    }
  });
  const orderById = new Map(((ordersResult.data || []) as OrderRow[]).map((order) => [order.id, order]));
  const licenseById = new Map(((licensesResult.data || []) as LicenseRow[]).map((license) => [license.id, license]));

  const counts = {
    total: disputeRows.length,
    open: disputeRows.filter((dispute) => dispute.status === "open").length,
    reviewing: disputeRows.filter((dispute) => dispute.status === "reviewing").length,
    resolved: disputeRows.filter((dispute) => dispute.status === "resolved").length,
    rejected: disputeRows.filter((dispute) => dispute.status === "rejected").length,
  };

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Resolution</p>
            <h1 className="mt-3 text-4xl font-bold text-white">Tus disputas</h1>
            <p className="mt-3 max-w-3xl text-[var(--text-soft)]">
              Esta bandeja resume el estado administrativo de cada caso, quien debe actuar ahora y
              como volver al pedido, a la licencia o al ticket relacionado sin perder contexto.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/support?view=buyer">
              <Button variant="secondary">Volver a soporte</Button>
            </Link>
            <Link href="/orders">
              <Button variant="ghost">Ir a pedidos</Button>
            </Link>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Casos</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.total}</p>
          </div>
          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-200">Abiertas</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.open}</p>
          </div>
          <div className="rounded-3xl border border-sky-500/20 bg-sky-500/10 p-5">
            <p className="text-sm text-sky-200">En revision</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.reviewing}</p>
          </div>
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-200">Resueltas</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.resolved}</p>
          </div>
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5">
            <p className="text-sm text-rose-200">Rechazadas</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.rejected}</p>
          </div>
        </div>

        {disputeRows.length > 0 ? (
          <div className="space-y-5">
            {disputeRows.map((dispute) => {
              const product = dispute.product_id ? productById.get(dispute.product_id) : null;
              const latestTicket = dispute.product_id ? latestTicketByProductId.get(dispute.product_id) || null : null;
              const assignedAdmin = dispute.assigned_admin_user_id
                ? adminById.get(dispute.assigned_admin_user_id) || null
                : null;
              const order = dispute.order_id ? orderById.get(dispute.order_id) || null : null;
              const license = dispute.license_id ? licenseById.get(dispute.license_id) || null : null;
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
                supportStatuses: latestTicket ? [latestTicket.status] : [],
                disputeStatuses: [dispute.status],
                productRefundPolicy: product?.refund_policy || null,
              });
              const adminLabel =
                assignedAdmin?.display_name || assignedAdmin?.username || assignedAdmin?.email || "Sin asignar";

              return (
                <article
                  key={dispute.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-white">
                          {product?.title || "Disputa de compra"}
                        </h2>
                        <Badge className={disputeStatusTone(dispute.status)}>
                          {disputeStatusLabel(dispute.status)}
                        </Badge>
                      </div>

                      <div className="mt-3 grid gap-3 text-sm text-[var(--text-soft)] md:grid-cols-2 xl:grid-cols-4">
                        <p>
                          Pedido:{" "}
                          <span className="text-white">
                            {dispute.order_id ? `#${dispute.order_id.slice(0, 8)}` : "Sin resolver"}
                          </span>
                        </p>
                        <p>
                          Admin: <span className="text-white">{adminLabel}</span>
                        </p>
                        <p>
                          Ultima actividad:{" "}
                          <span className="text-white">
                            {new Date(dispute.updated_at).toLocaleString("es-ES")}
                          </span>
                        </p>
                        <p>
                          Ticket relacionado:{" "}
                          <span className="text-white">
                            {latestTicket ? latestTicket.status : "Sin ticket visible"}
                          </span>
                        </p>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                          Siguiente accion
                        </p>
                        <p className="mt-3 text-sm text-white">{disputeNextActionLabel(dispute.status, "buyer")}</p>
                        <p className="mt-2 text-sm text-[var(--text-soft)]">
                          Responsable actual: {disputeActorLabel(dispute.status)}
                        </p>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-soft)]">
                          {dispute.reason}
                        </p>
                      </div>
                      <div className="mt-4">
                        <BuyerPostSaleClarityCard snapshot={transparencySnapshot} compact />
                      </div>
                    </div>

                    <div className="min-w-[250px] space-y-3">
                      <Link href={`/disputes/${dispute.id}`}>
                        <Button variant="primary">Abrir caso</Button>
                      </Link>

                      <div className="flex flex-wrap gap-2">
                        {dispute.order_id ? (
                          <Link href={`/orders?highlightOrder=${dispute.order_id}`}>
                            <Badge className="cursor-pointer border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white">
                              Ver pedido
                            </Badge>
                          </Link>
                        ) : null}
                        {latestTicket ? (
                          <Link href={`/support/tickets/${latestTicket.id}`}>
                            <Badge className="cursor-pointer border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white">
                              Ver ticket
                            </Badge>
                          </Link>
                        ) : null}
                        {product?.slug ? (
                          <Link href={`/products/${product.slug}`}>
                            <Badge className="cursor-pointer border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white">
                              Ver producto
                            </Badge>
                          </Link>
                        ) : null}
                        <Link href="/policies/reembolsos-y-reclamaciones">
                          <Badge className="cursor-pointer border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white">
                            Policy de reembolsos
                          </Badge>
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-lg font-semibold text-white">Todavia no has abierto disputas.</p>
            <p className="mt-3 text-[var(--text-soft)]">
              Si soporte no resuelve una incidencia de compra, licencia o entrega, podras seguir aqui
              el caso administrativo completo.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link href="/support?view=buyer" className="text-sm font-semibold text-white hover:underline">
                Ir a soporte
              </Link>
              <Link href="/orders" className="text-sm font-semibold text-white hover:underline">
                Revisar pedidos
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
