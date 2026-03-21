import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DisputeForm } from "@/components/community/dispute-form";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { BuyerPostSaleClarityCard } from "@/components/post-sale/buyer-post-sale-clarity-card";
import { SupportTicketActions } from "@/components/support/support-ticket-actions";
import { SupportMessageForm } from "@/components/support/support-message-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildBuyerPostSaleTransparencySnapshot } from "@/lib/post-sale/buyer-transparency";
import { createClient } from "@/lib/supabase/server";

type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";
type SupportTicketPriority = "normal" | "high";
type DisputeStatus = "open" | "reviewing" | "resolved" | "rejected";
type LicenseStatus = "active" | "revoked";

interface SupportTicketDetail {
  id: string;
  product_id: string;
  vendor_id: string;
  buyer_user_id: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  created_at: string;
  updated_at: string;
}

interface OwnedItemDetail {
  id: string;
  price_cents: number;
  order:
    | {
        id: string;
        user_id: string;
        status: string;
        created_at: string;
      }
    | Array<{
        id: string;
        user_id: string;
        status: string;
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

const STATUS_LABELS = {
  open: "Abierto",
  waiting_seller: "Esperando seller",
  waiting_buyer: "Esperando buyer",
  closed: "Cerrado",
} as const;

function nextActionLabel(status: SupportTicketStatus) {
  switch (status) {
    case "waiting_seller":
      return "Ahora corresponde al seller responder.";
    case "waiting_buyer":
      return "Necesitas responder para mantener el caso en movimiento.";
    case "closed":
      return "El ticket esta cerrado. Reabrelo o escala si el problema persiste.";
    default:
      return "El caso sigue abierto y puede avanzar por soporte normal.";
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

function normalizeOwnedItemDetail(rawItem: OwnedItemDetail | null) {
  if (!rawItem) {
    return {
      order: null,
      license: null,
    };
  }

  return {
    order: Array.isArray(rawItem.order) ? rawItem.order[0] || null : rawItem.order,
    license: Array.isArray(rawItem.license) ? rawItem.license[0] || null : rawItem.license,
  };
}

interface TicketPageProps {
  params: Promise<{
    ticketId: string;
  }>;
  searchParams?: Promise<{
    workspaceProductId?: string;
  }>;
}

export default async function SupportTicketPage({ params, searchParams }: TicketPageProps) {
  const { ticketId } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: ticketData } = await supabase
    .from("support_tickets")
    .select("id, product_id, vendor_id, buyer_user_id, subject, status, priority, created_at, updated_at")
    .eq("id", ticketId)
    .single();

  const ticket = ticketData as SupportTicketDetail | null;

  if (!ticket) {
    notFound();
  }

  const [messagesResult, productResult, vendorResult, ownedItemResult, disputesResult] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, sender_user_id, body, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true }),
    supabase.from("products").select("id, title, slug, refund_policy").eq("id", ticket.product_id).maybeSingle(),
    supabase.from("vendors").select("id, user_id, store_name, slug").eq("id", ticket.vendor_id).maybeSingle(),
    supabase
      .from("order_items")
      .select(
        "id, price_cents, order:orders!inner(id, user_id, status, created_at), license:licenses(id, status, license_key, issued_at)"
      )
      .eq("product_id", ticket.product_id)
      .eq("order.user_id", ticket.buyer_user_id)
      .in("order.status", ["completed", "refunded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("disputes")
      .select("id, order_id, product_id, license_id, status, updated_at")
      .eq("opened_by_user_id", ticket.buyer_user_id)
      .eq("product_id", ticket.product_id)
      .order("updated_at", { ascending: false }),
  ]);

  const isBuyer = ticket.buyer_user_id === user.id;
  const isSeller = vendorResult.data?.user_id === user.id;
  const workspaceProductId =
    resolvedSearchParams.workspaceProductId === ticket.product_id ? ticket.product_id : null;

  if (!isBuyer && !isSeller) {
    notFound();
  }

  const messages = messagesResult.data || [];
  const ownedItem = normalizeOwnedItemDetail((ownedItemResult.data || null) as unknown as OwnedItemDetail | null);
  const license = ownedItem.license;
  const activeDispute =
    (disputesResult.data || []).find(
      (dispute) => dispute.status === "open" || dispute.status === "reviewing"
    ) || null;
  const transparencySnapshot = buildBuyerPostSaleTransparencySnapshot({
    orderStatus: ownedItem.order?.status,
    accessOk: license?.status === "active",
    accessMessage:
      license?.status === "revoked"
        ? "Licencia revocada"
        : ownedItem.order?.id
          ? "Compra registrada"
          : "Compra no resuelta",
    licenseStatus: license?.status || null,
    hasDownload: false,
    supportStatuses: [ticket.status],
    disputeStatuses: activeDispute ? [activeDispute.status as DisputeStatus] : [],
    productRefundPolicy: productResult.data?.refund_policy || null,
  });

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
          <Link href="/support" className="hover:text-white">
            Support
          </Link>
          <span>/</span>
          <span className="text-white">{ticket.subject}</span>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[0.8fr_1.2fr]">
          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Ticket</p>
              <h1 className="mt-3 text-3xl font-bold text-white">{ticket.subject}</h1>

              <div className="mt-5 space-y-3 text-sm text-[var(--text-soft)]">
                <p>
                  Estado: <span className="text-white">{STATUS_LABELS[ticket.status]}</span>
                </p>
                <p>
                  Prioridad:{" "}
                  <span className="text-white">
                    {ticket.priority === "high" ? "Alta" : "Normal"}
                  </span>
                </p>
                <p>
                  Producto: <span className="text-white">{productResult.data?.title || "Producto"}</span>
                </p>
                <p>
                  Seller: <span className="text-white">{vendorResult.data?.store_name || "Tienda"}</span>
                </p>
                <p>
                  Creado:{" "}
                  <span className="text-white">
                    {new Date(ticket.created_at).toLocaleString("es-ES")}
                  </span>
                </p>
                <p>
                  Siguiente accion: <span className="text-white">{nextActionLabel(ticket.status)}</span>
                </p>
                <p>
                  Pedido relacionado:{" "}
                  <span className="text-white">
                    {ownedItem?.order?.id ? `#${ownedItem.order.id.slice(0, 8)}` : "No resuelto"}
                  </span>
                </p>
                <p>
                  Licencia:{" "}
                  <span className="text-white">
                    {license?.status === "active"
                      ? "Activa"
                      : license?.status === "revoked"
                        ? "Revocada"
                        : "Sin licencia emitida"}
                  </span>
                </p>
                <p>
                  Ultima actividad:{" "}
                  <span className="text-white">
                    {new Date(ticket.updated_at).toLocaleString("es-ES")}
                  </span>
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {workspaceProductId && isSeller ? (
                  <Link href={`/seller/products/${workspaceProductId}/support`}>
                    <Button variant="secondary">Volver al soporte del producto</Button>
                  </Link>
                ) : (
                  <Link href="/support">
                    <Button variant="secondary">Volver a soporte</Button>
                  </Link>
                )}
                <SupportTicketActions ticketId={ticket.id} status={ticket.status} />
                {ownedItem?.order?.id ? (
                  <Link href={`/orders?highlightOrder=${ownedItem.order.id}`}>
                    <Button variant="ghost">Ver pedido</Button>
                  </Link>
                ) : null}
                {productResult.data?.slug ? (
                  <Link href={`/products/${productResult.data.slug}`}>
                    <Button variant="ghost">Ver producto</Button>
                  </Link>
                ) : null}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                  Escalado administrativo
                </p>
                {activeDispute ? (
                  <div className="mt-3 space-y-3">
                    <Badge className={disputeBadgeClass(activeDispute.status as DisputeStatus)}>
                      {disputeLabel(activeDispute.status as DisputeStatus)}
                    </Badge>
                    <p className="text-sm text-[var(--text-soft)]">
                      Este caso ya esta escalado al marketplace. Puedes seguir el estado desde la
                      bandeja de disputas.
                    </p>
                    <Link href="/disputes">
                      <Button variant="secondary">Ver disputa</Button>
                    </Link>
                  </div>
                ) : isBuyer && ownedItem?.order?.id ? (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-[var(--text-soft)]">
                      Si soporte no resuelve el problema de forma razonable, puedes abrir disputa con
                      el contexto de este producto, pedido y licencia.
                    </p>
                    <DisputeForm
                      orderId={ownedItem.order.id}
                      productId={ticket.product_id}
                      licenseId={license?.id || null}
                      productTitle={productResult.data?.title || "Producto"}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[var(--text-soft)]">
                    El escalado administrativo solo esta disponible para el buyer propietario de esta
                    compra.
                  </p>
                )}
              </div>

              <div className="mt-6">
                <BuyerPostSaleClarityCard snapshot={transparencySnapshot} />
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/policies/reembolsos-y-reclamaciones">
                    <Button variant="secondary">Policy de reembolsos</Button>
                  </Link>
                  {ownedItem?.order?.id ? (
                    <Link href={`/orders?highlightOrder=${ownedItem.order.id}`}>
                      <Button variant="ghost">Ver pedido</Button>
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <SupportMessageForm ticketId={ticket.id} disabled={ticket.status === "closed"} />
          </aside>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Conversacion</h2>

            {messages.length > 0 ? (
              <div className="mt-5 space-y-4">
                {messages.map((message) => {
                  const ownMessage = message.sender_user_id === user.id;

                  return (
                    <article
                      key={message.id}
                      className={`rounded-2xl border p-4 ${
                        ownMessage
                          ? "border-[var(--primary)]/30 bg-[var(--primary)]/10"
                          : "border-white/10 bg-black/10"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-white">
                          {ownMessage ? "Tu mensaje" : isSeller ? "Buyer" : "Seller"}
                        </p>
                        <p className="text-xs text-[var(--text-soft)]">
                          {new Date(message.created_at).toLocaleString("es-ES")}
                        </p>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-soft)]">
                        {message.body}
                      </p>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-5 text-[var(--text-soft)]">Aun no hay mensajes en este ticket.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
