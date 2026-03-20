import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { SupportTicketActions } from "@/components/support/support-ticket-actions";
import { SupportMessageForm } from "@/components/support/support-message-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";
type SupportTicketPriority = "normal" | "high";

interface SupportTicketDetail {
  id: string;
  product_id: string;
  vendor_id: string;
  buyer_user_id: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  created_at: string;
}

const STATUS_LABELS = {
  open: "Abierto",
  waiting_seller: "Esperando seller",
  waiting_buyer: "Esperando buyer",
  closed: "Cerrado",
} as const;

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
    .select("id, product_id, vendor_id, buyer_user_id, subject, status, priority, created_at")
    .eq("id", ticketId)
    .single();

  const ticket = ticketData as SupportTicketDetail | null;

  if (!ticket) {
    notFound();
  }

  const [messagesResult, productResult, vendorResult] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, sender_user_id, body, created_at")
      .eq("ticket_id", ticket.id)
      .order("created_at", { ascending: true }),
    supabase.from("products").select("id, title, slug").eq("id", ticket.product_id).maybeSingle(),
    supabase.from("vendors").select("id, user_id, store_name, slug").eq("id", ticket.vendor_id).maybeSingle(),
  ]);

  const isBuyer = ticket.buyer_user_id === user.id;
  const isSeller = vendorResult.data?.user_id === user.id;
  const workspaceProductId =
    resolvedSearchParams.workspaceProductId === ticket.product_id ? ticket.product_id : null;

  if (!isBuyer && !isSeller) {
    notFound();
  }

  const messages = messagesResult.data || [];

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
                {productResult.data?.slug ? (
                  <Link href={`/products/${productResult.data.slug}`}>
                    <Button variant="ghost">Ver producto</Button>
                  </Link>
                ) : null}
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
