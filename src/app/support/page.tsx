import Link from "next/link";
import { redirect } from "next/navigation";
import { DisputeForm } from "@/components/community/dispute-form";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { BuyerPostSaleClarityCard } from "@/components/post-sale/buyer-post-sale-clarity-card";
import { SellerSupportQueue } from "@/components/seller/seller-support-queue";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildBuyerPostSaleTransparencySnapshot } from "@/lib/post-sale/buyer-transparency";
import { createClient } from "@/lib/supabase/server";

type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";
type SupportTicketPriority = "normal" | "high";
type SupportView = "buyer" | "seller";
type DisputeStatus = "open" | "reviewing" | "resolved" | "rejected";
type LicenseStatus = "active" | "revoked";

interface SupportTicketListItem {
  id: string;
  product_id: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  updated_at: string;
  created_at: string;
  last_message_at: string;
}

interface ProductContextRow {
  id: string;
  title: string;
  slug: string;
  refund_policy?: string | null;
}

interface SupportPageProps {
  searchParams?: Promise<{
    product?: string;
    status?: string;
    view?: string;
  }>;
}

interface DisputeRow {
  id: string;
  product_id: string | null;
  order_id: string | null;
  license_id: string | null;
  status: DisputeStatus;
  updated_at: string;
}

interface OwnedItemRow {
  product_id: string;
  price_cents: number;
  order:
    | {
        id: string;
        status: string;
        user_id: string;
        created_at: string;
      }
    | Array<{
        id: string;
        status: string;
        user_id: string;
        created_at: string;
      }>
    | null;
  license:
    | {
        id: string;
        status: LicenseStatus;
        license_key: string;
        issued_at: string;
      }
    | Array<{
        id: string;
        status: LicenseStatus;
        license_key: string;
        issued_at: string;
      }>
    | null;
}

function normalizeOwnedItemRow(rawItem: OwnedItemRow) {
  const order = Array.isArray(rawItem.order) ? rawItem.order[0] || null : rawItem.order;
  const license = Array.isArray(rawItem.license) ? rawItem.license[0] || null : rawItem.license;

  return {
    productId: rawItem.product_id,
    priceCents: rawItem.price_cents,
    orderId: order?.id || null,
    orderCreatedAt: order?.created_at || null,
    licenseId: license?.id || null,
    licenseStatus: license?.status || null,
  };
}

const STATUS_LABELS = {
  open: "Abierto",
  waiting_seller: "Esperando seller",
  waiting_buyer: "Esperando buyer",
  closed: "Cerrado",
} as const;

function normalizeStatus(value: string | undefined): SupportTicketStatus | "all" {
  if (value === "open" || value === "waiting_seller" || value === "waiting_buyer" || value === "closed") {
    return value;
  }

  return "all";
}

function normalizeView(value: string | undefined, hasVendor: boolean): SupportView {
  if (value === "seller" && hasVendor) {
    return "seller";
  }

  return "buyer";
}

function nextActionLabel(status: SupportTicketStatus) {
  switch (status) {
    case "waiting_seller":
      return "Espera respuesta del seller";
    case "waiting_buyer":
      return "Te toca responder para avanzar";
    case "closed":
      return "Ticket cerrado. Reabre o escala si sigue sin resolverse";
    default:
      return "Conversacion abierta en curso";
  }
}

function disputeBadgeClass(status: DisputeStatus) {
  switch (status) {
    case "open":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "reviewing":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    case "resolved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "rejected":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }
}

function disputeLabel(status: DisputeStatus) {
  switch (status) {
    case "open":
      return "Disputa abierta";
    case "reviewing":
      return "Disputa en revision";
    case "resolved":
      return "Disputa resuelta";
    case "rejected":
      return "Disputa rechazada";
  }
}

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const supabase = await createClient();
  const params = (await searchParams) || {};
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const selectedStatus = normalizeStatus(params.status);
  const selectedView = normalizeView(params.view, Boolean(vendor?.id));
  const selectedProductId = params.product || null;

  const [ticketsResult, downloadsResult, ordersResult, disputesResult] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id, product_id, subject, status, priority, updated_at, created_at, last_message_at")
      .eq("buyer_user_id", user.id)
      .order("last_message_at", { ascending: false }),
    supabase.from("downloads").select("product_id").eq("user_id", user.id),
    supabase
      .from("order_items")
      .select(
        "product_id, price_cents, order:orders!inner(id, status, user_id, created_at), license:licenses(id, status, license_key, issued_at)"
      )
      .eq("order.user_id", user.id)
      .eq("order.status", "completed"),
    supabase
      .from("disputes")
      .select("id, product_id, order_id, license_id, status, updated_at")
      .eq("opened_by_user_id", user.id)
      .order("updated_at", { ascending: false }),
  ]);

  const accessibleProductIds = Array.from(
    new Set([
      ...(downloadsResult.data || []).map((item) => item.product_id),
      ...((ordersResult.data || []) as unknown as OwnedItemRow[]).map((item) => item.product_id),
    ])
  );

  const { data: products } = accessibleProductIds.length
    ? await supabase
        .from("products")
        .select("id, title")
        .in("id", accessibleProductIds)
        .eq("moderation_status", "approved")
        .order("title", { ascending: true })
    : { data: [] as Array<{ id: string; title: string }> };

  const ticketProductIds = Array.from(
    new Set((ticketsResult.data || []).map((ticket) => ticket.product_id))
  );
  const disputeProductIds = Array.from(
    new Set(((disputesResult.data || []) as DisputeRow[]).map((dispute) => dispute.product_id).filter(Boolean) as string[])
  );
  const productLookupIds = Array.from(
    new Set([...accessibleProductIds, ...ticketProductIds, ...disputeProductIds])
  );
  const { data: ticketProducts } = productLookupIds.length
      ? await supabase.from("products").select("id, title, slug, refund_policy").in("id", productLookupIds)
      : { data: [] as ProductContextRow[] };

  const productById = new Map((ticketProducts || []).map((product) => [product.id, product]));

  const ownedContextByProductId = new Map<
    string,
    {
      orderId: string | null;
      orderCreatedAt: string | null;
      priceCents: number | null;
      licenseId: string | null;
      licenseStatus: LicenseStatus | null;
    }
  >();

  ((ordersResult.data || []) as unknown as OwnedItemRow[]).forEach((item) => {
    const normalized = normalizeOwnedItemRow(item);
    const current = ownedContextByProductId.get(normalized.productId);

    if (
      !current ||
      new Date(normalized.orderCreatedAt || 0).getTime() > new Date(current.orderCreatedAt || 0).getTime()
    ) {
      ownedContextByProductId.set(normalized.productId, {
        orderId: normalized.orderId,
        orderCreatedAt: normalized.orderCreatedAt,
        priceCents: normalized.priceCents,
        licenseId: normalized.licenseId,
        licenseStatus: normalized.licenseStatus,
      });
    }
  });

  const activeDisputeByProductId = new Map<string, DisputeRow>();
  ((disputesResult.data || []) as DisputeRow[]).forEach((dispute) => {
    if (!dispute.product_id) {
      return;
    }

    if (dispute.status === "open" || dispute.status === "reviewing") {
      if (!activeDisputeByProductId.has(dispute.product_id)) {
        activeDisputeByProductId.set(dispute.product_id, dispute);
      }
    }
  });

  const tickets = ((selectedStatus === "all"
    ? ticketsResult.data || []
    : (ticketsResult.data || []).filter((ticket) => ticket.status === selectedStatus)) ||
    []) as SupportTicketListItem[];

  const openTickets = ((ticketsResult.data || []) as SupportTicketListItem[]).filter(
    (ticket) => ticket.status !== "closed"
  ).length;
  const waitingSellerCount = ((ticketsResult.data || []) as SupportTicketListItem[]).filter(
    (ticket) => ticket.status === "waiting_seller"
  ).length;
  const waitingBuyerCount = ((ticketsResult.data || []) as SupportTicketListItem[]).filter(
    (ticket) => ticket.status === "waiting_buyer"
  ).length;
  const activeDisputesCount = activeDisputeByProductId.size;

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Support & Resolution</p>
          <h1 className="mt-3 text-4xl font-bold text-white">Centro de soporte y resolucion</h1>
          <p className="mt-3 max-w-3xl text-[var(--text-soft)]">
            Desde aqui puedes abrir soporte, seguir el estado de tus incidencias, saber quien debe
            responder y escalar a disputa cuando un caso ya necesita revision administrativa.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/orders" className="text-sm font-semibold text-white hover:underline">
              Ir a pedidos
            </Link>
            <Link href="/licenses" className="text-sm font-semibold text-white hover:underline">
              Ir a biblioteca
            </Link>
            <Link href="/disputes" className="text-sm font-semibold text-white hover:underline">
              Ver disputas
            </Link>
            <Link
              href="/policies/soporte-del-marketplace"
              className="text-sm font-semibold text-white hover:underline"
            >
              Policy de soporte
            </Link>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Tickets abiertos</p>
            <p className="mt-2 text-3xl font-bold text-white">{openTickets}</p>
          </div>
          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-200">Esperando seller</p>
            <p className="mt-2 text-3xl font-bold text-white">{waitingSellerCount}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Te toca responder</p>
            <p className="mt-2 text-3xl font-bold text-white">{waitingBuyerCount}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Disputas activas</p>
            <p className="mt-2 text-3xl font-bold text-white">{activeDisputesCount}</p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <Link href="/support?view=buyer">
            <Button variant={selectedView === "buyer" ? "primary" : "secondary"}>Buyer</Button>
          </Link>
          {vendor?.id ? (
            <Link href="/support?view=seller">
              <Button variant={selectedView === "seller" ? "primary" : "secondary"}>
                Seller
              </Button>
            </Link>
          ) : null}
          <Link href={`/support?view=${selectedView}`}>
            <Button variant={selectedStatus === "all" ? "primary" : "secondary"}>Todos</Button>
          </Link>
          <Link href={`/support?view=${selectedView}&status=waiting_seller`}>
            <Button variant={selectedStatus === "waiting_seller" ? "primary" : "secondary"}>
              Esperando seller
            </Button>
          </Link>
          <Link href={`/support?view=${selectedView}&status=waiting_buyer`}>
            <Button variant={selectedStatus === "waiting_buyer" ? "primary" : "secondary"}>
              Esperando buyer
            </Button>
          </Link>
          <Link href={`/support?view=${selectedView}&status=closed`}>
            <Button variant={selectedStatus === "closed" ? "primary" : "secondary"}>
              Cerrados
            </Button>
          </Link>
        </div>

        {selectedView === "seller" && vendor?.id ? (
          <SellerSupportQueue vendorId={vendor.id} statusFilter={selectedStatus} />
        ) : (
          <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
            <SupportTicketForm products={products || []} initialProductId={selectedProductId} />

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Mis incidencias</h2>
                  <p className="mt-2 text-sm text-[var(--text-soft)]">
                    Sigue tickets, entiende el siguiente paso y escala a disputa solo cuando el caso
                    ya necesita intervencion administrativa.
                  </p>
                </div>
                <Link href="/disputes">
                  <Button variant="secondary">Mis disputas</Button>
                </Link>
              </div>

              {tickets.length > 0 ? (
                <div className="space-y-4">
                  {tickets.map((ticket) => {
                    const product = productById.get(ticket.product_id);
                    const ownedContext = ownedContextByProductId.get(ticket.product_id) || null;
                    const activeDispute = activeDisputeByProductId.get(ticket.product_id) || null;
                    const transparencySnapshot = buildBuyerPostSaleTransparencySnapshot({
                      orderStatus: ownedContext?.orderId ? "completed" : null,
                      accessOk: ownedContext?.licenseStatus === "active",
                      accessMessage:
                        ownedContext?.licenseStatus === "revoked"
                          ? "Licencia revocada"
                          : ownedContext?.orderId
                            ? "Compra registrada"
                            : "Compra no resuelta",
                      licenseStatus: ownedContext?.licenseStatus || null,
                      supportStatuses: [ticket.status],
                      disputeStatuses: activeDispute ? [activeDispute.status] : [],
                      productRefundPolicy: product?.refund_policy || null,
                    });

                    return (
                      <div
                        key={ticket.id}
                        className="rounded-2xl border border-white/10 bg-black/10 p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{ticket.subject}</p>
                              <Badge className="border-white/10 bg-white/5 text-[var(--text-soft)]">
                                {STATUS_LABELS[ticket.status]}
                              </Badge>
                              {activeDispute ? (
                                <Badge className={disputeBadgeClass(activeDispute.status)}>
                                  {disputeLabel(activeDispute.status)}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-[var(--text-soft)]">
                              {product?.title || "Producto"}
                            </p>
                          </div>
                          <div className="text-right text-xs text-[var(--text-soft)]">
                            <p>{ticket.priority === "high" ? "Alta prioridad" : "Prioridad normal"}</p>
                            <p>
                              Ultima actividad{" "}
                              {new Date(ticket.last_message_at).toLocaleString("es-ES")}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-[var(--text-soft)] md:grid-cols-2">
                          <p>
                            Siguiente accion:{" "}
                            <span className="text-white">{nextActionLabel(ticket.status)}</span>
                          </p>
                          <p>
                            Pedido relacionado:{" "}
                            <span className="text-white">
                              {ownedContext?.orderId ? `#${ownedContext.orderId.slice(0, 8)}` : "No resuelto"}
                            </span>
                          </p>
                          <p>
                            Licencia:{" "}
                            <span className="text-white">
                              {ownedContext?.licenseStatus === "active"
                                ? "Activa"
                                : ownedContext?.licenseStatus === "revoked"
                                  ? "Revocada"
                                  : "Sin licencia emitida"}
                            </span>
                          </p>
                          <p>
                            Escalado:{" "}
                            <span className="text-white">
                              {activeDispute
                                ? disputeLabel(activeDispute.status)
                                : "Aun no escalado"}
                            </span>
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link href={`/support/tickets/${ticket.id}`}>
                            <Button variant="ghost">Abrir ticket</Button>
                          </Link>
                          {ownedContext?.orderId ? (
                            <Link href={`/orders?highlightOrder=${ownedContext.orderId}`}>
                              <Button variant="secondary">Ver pedido</Button>
                            </Link>
                          ) : null}
                          {activeDispute ? (
                            <Link href="/disputes">
                              <Button variant="secondary">Ver disputa</Button>
                            </Link>
                          ) : ownedContext?.orderId ? (
                            <DisputeForm
                              orderId={ownedContext.orderId}
                              productId={ticket.product_id}
                              licenseId={ownedContext.licenseId || null}
                              productTitle={product?.title || "Producto"}
                            />
                          ) : null}
                        </div>
                        <div className="mt-4">
                          <BuyerPostSaleClarityCard snapshot={transparencySnapshot} compact />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/10 px-5 py-8">
                  <p className="text-white">Todavia no has abierto tickets.</p>
                  <p className="mt-2 text-sm text-[var(--text-soft)]">
                    Si tienes una compra activa y necesitas ayuda, abre soporte desde aqui o desde el
                    pedido o la biblioteca correspondiente.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
