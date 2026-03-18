import Link from "next/link";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";
type SupportTicketPriority = "normal" | "high";

interface SupportTicketRow {
  id: string;
  product_id: string;
  vendor_id: string;
  buyer_user_id: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

interface SupportMessageRow {
  ticket_id: string;
  sender_user_id: string;
  created_at: string;
}

interface VendorRow {
  id: string;
  user_id: string;
  store_name: string;
}

interface ProductRow {
  id: string;
  title: string;
  slug: string;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
}

function hoursBetween(start: string, end: string) {
  return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
}

function formatDuration(hours: number | null) {
  if (hours === null) {
    return "Sin datos";
  }

  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))} min`;
  }

  if (hours < 24) {
    return `${hours.toFixed(1)} h`;
  }

  return `${(hours / 24).toFixed(1)} d`;
}

function getSlaState(ticket: SupportTicketRow, nowIso: string) {
  if (ticket.status === "closed") {
    return "closed";
  }

  const ageHours = hoursBetween(ticket.last_message_at, nowIso);

  if (ticket.status === "waiting_seller" && ageHours >= 24) {
    return "breached";
  }

  if (ticket.status === "waiting_seller" && ageHours >= 12) {
    return "risk";
  }

  return "healthy";
}

function getQueueWeight(ticket: SupportTicketRow, nowIso: string) {
  const slaState = getSlaState(ticket, nowIso);
  let score = ticket.priority === "high" ? 100 : 10;

  if (ticket.status === "waiting_seller") {
    score += 50;
  }

  if (slaState === "risk") {
    score += 100;
  }

  if (slaState === "breached") {
    score += 200;
  }

  return score;
}

export default async function AdminSupportPage() {
  await requireAdminContext();
  const adminSupabase = createAdminClient();

  const { data: tickets } = (await adminSupabase
    .from("support_tickets")
    .select(
      "id, product_id, vendor_id, buyer_user_id, subject, status, priority, created_at, updated_at, last_message_at"
    )
    .order("last_message_at", { ascending: false })) as { data: SupportTicketRow[] | null };

  const supportTickets = tickets || [];
  const nowIso = new Date().toISOString();

  const ticketIds = Array.from(new Set(supportTickets.map((ticket) => ticket.id)));
  const vendorIds = Array.from(new Set(supportTickets.map((ticket) => ticket.vendor_id)));
  const productIds = Array.from(new Set(supportTickets.map((ticket) => ticket.product_id)));
  const buyerIds = Array.from(new Set(supportTickets.map((ticket) => ticket.buyer_user_id)));

  const [{ data: messages }, { data: vendors }, { data: products }, { data: buyers }] =
    await Promise.all([
      ticketIds.length
        ? adminSupabase
            .from("support_messages")
            .select("ticket_id, sender_user_id, created_at")
            .in("ticket_id", ticketIds)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as SupportMessageRow[] }),
      vendorIds.length
        ? adminSupabase.from("vendors").select("id, user_id, store_name").in("id", vendorIds)
        : Promise.resolve({ data: [] as VendorRow[] }),
      productIds.length
        ? adminSupabase.from("products").select("id, title, slug").in("id", productIds)
        : Promise.resolve({ data: [] as ProductRow[] }),
      buyerIds.length
        ? adminSupabase
            .from("profiles")
            .select("id, username, display_name, email")
            .in("id", buyerIds)
        : Promise.resolve({ data: [] as ProfileRow[] }),
    ]);

  const messageRows = (messages || []) as SupportMessageRow[];
  const vendorById = new Map(((vendors || []) as VendorRow[]).map((vendor) => [vendor.id, vendor]));
  const productById = new Map(((products || []) as ProductRow[]).map((product) => [product.id, product]));
  const buyerById = new Map(((buyers || []) as ProfileRow[]).map((buyer) => [buyer.id, buyer]));

  const firstResponseSamples = supportTickets
    .map((ticket) => {
      const vendor = vendorById.get(ticket.vendor_id);
      if (!vendor) {
        return null;
      }

      const ticketMessages = messageRows.filter((message) => message.ticket_id === ticket.id);
      const firstBuyerMessage = ticketMessages.find(
        (message) => message.sender_user_id !== vendor.user_id
      );
      const firstSellerMessage = ticketMessages.find(
        (message) => message.sender_user_id === vendor.user_id
      );

      if (!firstBuyerMessage || !firstSellerMessage) {
        return null;
      }

      return Math.max(
        0,
        hoursBetween(firstBuyerMessage.created_at, firstSellerMessage.created_at)
      );
    })
    .filter((sample): sample is number => sample !== null);

  const avgFirstResponseHours =
    firstResponseSamples.length > 0
      ? firstResponseSamples.reduce((sum, sample) => sum + sample, 0) / firstResponseSamples.length
      : null;

  const counts = {
    total: supportTickets.length,
    waitingSeller: supportTickets.filter((ticket) => ticket.status === "waiting_seller").length,
    waitingBuyer: supportTickets.filter((ticket) => ticket.status === "waiting_buyer").length,
    highPriority: supportTickets.filter((ticket) => ticket.priority === "high").length,
    risk: supportTickets.filter((ticket) => getSlaState(ticket, nowIso) === "risk").length,
    breached: supportTickets.filter((ticket) => getSlaState(ticket, nowIso) === "breached").length,
  };

  const sellerOps = Array.from(
    vendorById.values().map((vendor) => {
      const vendorTickets = supportTickets.filter((ticket) => ticket.vendor_id === vendor.id);
      return {
        vendorId: vendor.id,
        storeName: vendor.store_name,
        total: vendorTickets.length,
        waitingSeller: vendorTickets.filter((ticket) => ticket.status === "waiting_seller").length,
        breached: vendorTickets.filter((ticket) => getSlaState(ticket, nowIso) === "breached").length,
        highPriority: vendorTickets.filter((ticket) => ticket.priority === "high").length,
      };
    })
  )
    .sort(
      (a, b) =>
        b.waitingSeller - a.waitingSeller ||
        b.breached - a.breached ||
        b.highPriority - a.highPriority ||
        a.storeName.localeCompare(b.storeName)
    )
    .slice(0, 6);

  const criticalQueue = [...supportTickets]
    .filter((ticket) => ticket.status !== "closed")
    .sort((a, b) => getQueueWeight(b, nowIso) - getQueueWeight(a, nowIso))
    .slice(0, 12);

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Admin</p>
            <h1 className="mt-3 text-4xl font-bold text-white">Support Ops</h1>
            <p className="mt-3 max-w-3xl text-[var(--text-soft)]">
              Supervisa backlog, riesgo SLA y rendimiento de respuesta para mantener el soporte del
              marketplace a nivel profesional.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="secondary">Volver a admin</Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Tickets</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-200">Esperando seller</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.waitingSeller}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Esperando buyer</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.waitingBuyer}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5">
            <p className="text-sm text-rose-200">Alta prioridad</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.highPriority}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-200">SLA en riesgo</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.risk}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5">
            <p className="text-sm text-rose-200">SLA incumplido</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.breached}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Cola critica</h2>
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  Tickets ordenados por prioridad operativa, riesgo SLA y tiempo de espera.
                </p>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                SLA media: {formatDuration(avgFirstResponseHours)}
              </div>
            </div>

            {criticalQueue.length > 0 ? (
              <div className="mt-5 space-y-4">
                {criticalQueue.map((ticket) => {
                  const vendor = vendorById.get(ticket.vendor_id);
                  const buyer = buyerById.get(ticket.buyer_user_id);
                  const product = productById.get(ticket.product_id);
                  const slaState = getSlaState(ticket, nowIso);
                  const buyerLabel =
                    buyer?.display_name || buyer?.username || buyer?.email || "Buyer";

                  return (
                    <article
                      key={ticket.id}
                      className="rounded-2xl border border-white/10 bg-black/10 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{ticket.subject}</h3>
                          <p className="mt-2 text-sm text-[var(--text-soft)]">
                            {product?.title || "Producto"} · {vendor?.store_name || "Tienda"} ·{" "}
                            {buyerLabel}
                          </p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="text-white">
                            {ticket.priority === "high" ? "Alta prioridad" : "Prioridad normal"}
                          </p>
                          <p className="mt-2 text-[var(--text-soft)]">
                            {new Date(ticket.last_message_at).toLocaleString("es-ES")}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.14em]">
                        <span className="rounded-full border border-white/10 px-3 py-1 text-white">
                          {ticket.status}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 ${
                            slaState === "breached"
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                              : slaState === "risk"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          }`}
                        >
                          {slaState === "breached"
                            ? "SLA incumplido"
                            : slaState === "risk"
                              ? "SLA en riesgo"
                              : "Dentro de SLA"}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link href={`/support/tickets/${ticket.id}`}>
                          <Button variant="ghost">Abrir ticket</Button>
                        </Link>
                        {product?.slug ? (
                          <Link href={`/products/${product.slug}`}>
                            <Button variant="secondary">Ver producto</Button>
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center">
                <p className="text-[var(--text-soft)]">No hay tickets activos en este momento.</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Top sellers por backlog</h2>
              <div className="mt-4 space-y-3">
                {sellerOps.length > 0 ? (
                  sellerOps.map((seller) => (
                    <div
                      key={seller.vendorId}
                      className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">{seller.storeName}</p>
                        <p className="text-xs text-[var(--text-soft)]">{seller.total} tickets</p>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--text-soft)]">
                        <span>Esperando seller: {seller.waitingSeller}</span>
                        <span>Alta prioridad: {seller.highPriority}</span>
                        <span>Incumplidos: {seller.breached}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[var(--text-soft)]">Sin sellers con tickets activos.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Criterio SLA actual</h2>
              <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
                <p>Riesgo SLA: ticket en `waiting_seller` con 12h o más sin respuesta.</p>
                <p>Incumplimiento SLA: ticket en `waiting_seller` con 24h o más sin respuesta.</p>
                <p>La media de primera respuesta se calcula desde el primer mensaje buyer hasta la primera respuesta seller.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
