import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { SellerSupportQueue } from "@/components/seller/seller-support-queue";
import { SupportTicketForm } from "@/components/support/support-ticket-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";
type SupportTicketPriority = "normal" | "high";
type SupportView = "buyer" | "seller";

interface SupportTicketListItem {
  id: string;
  product_id: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  updated_at: string;
  created_at: string;
}

interface SupportPageProps {
  searchParams?: Promise<{
    product?: string;
    status?: string;
    view?: string;
  }>;
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

  const [ticketsResult, downloadsResult, ordersResult] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id, product_id, subject, status, priority, updated_at, created_at")
      .eq("buyer_user_id", user.id)
      .order("last_message_at", { ascending: false }),
    supabase.from("downloads").select("product_id").eq("user_id", user.id),
    supabase
      .from("order_items")
      .select("product_id, order:orders!inner(user_id, status)")
      .eq("order.user_id", user.id)
      .eq("order.status", "completed"),
  ]);

  const accessibleProductIds = Array.from(
    new Set([
      ...(downloadsResult.data || []).map((item) => item.product_id),
      ...(ordersResult.data || []).map((item) => item.product_id),
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
  const productLookupIds = Array.from(new Set([...accessibleProductIds, ...ticketProductIds]));
  const { data: ticketProducts } = productLookupIds.length
    ? await supabase.from("products").select("id, title, slug").in("id", productLookupIds)
    : { data: [] as Array<{ id: string; title: string; slug: string }> };

  const productById = new Map((ticketProducts || []).map((product) => [product.id, product]));
  const tickets = ((selectedStatus === "all"
    ? ticketsResult.data || []
    : (ticketsResult.data || []).filter((ticket) => ticket.status === selectedStatus)) ||
    []) as SupportTicketListItem[];

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Support</p>
          <h1 className="mt-3 text-4xl font-bold text-white">Centro de soporte</h1>
          <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
            Gestiona incidencias y dudas con sellers desde un flujo unificado para compradores y
            creadores.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/help" className="text-sm font-semibold text-white hover:underline">
              Help center
            </Link>
            <Link
              href="/policies/soporte-del-marketplace"
              className="text-sm font-semibold text-white hover:underline"
            >
              Policy de soporte
            </Link>
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
          <SellerSupportQueue
            vendorId={vendor.id}
            statusFilter={selectedStatus}
          />
        ) : (
          <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
            <SupportTicketForm products={products || []} initialProductId={selectedProductId} />

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Mis tickets</h2>
                  <p className="mt-2 text-sm text-[var(--text-soft)]">
                    Conversaciones activas con sellers sobre productos de tu biblioteca.
                  </p>
                </div>
                <Link href="/orders">
                  <Button variant="secondary">Mis pedidos</Button>
                </Link>
              </div>

              {tickets.length > 0 ? (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="rounded-2xl border border-white/10 bg-black/10 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{ticket.subject}</p>
                          <p className="mt-1 text-sm text-[var(--text-soft)]">
                            {productById.get(ticket.product_id)?.title || "Producto"}
                          </p>
                        </div>
                        <div className="text-right text-xs text-[var(--text-soft)]">
                          <p>{STATUS_LABELS[ticket.status]}</p>
                          <p>
                            {ticket.priority === "high" ? "Alta prioridad" : "Prioridad normal"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link href={`/support/tickets/${ticket.id}`}>
                          <Button variant="ghost">Abrir ticket</Button>
                        </Link>
                        {productById.get(ticket.product_id)?.slug ? (
                          <Link href={`/products/${productById.get(ticket.product_id)?.slug}`}>
                            <Button variant="secondary">Ver producto</Button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[var(--text-soft)]">Todavia no has abierto tickets.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
