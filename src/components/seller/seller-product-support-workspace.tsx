"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";
type SupportTicketPriority = "normal" | "high";

export interface SellerProductSupportTicketItem {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  buyerLabel: string;
  lastMessageBody: string | null;
  lastMessageAuthorLabel: string | null;
  lastMessageCreatedAt: string | null;
}

interface SellerProductSupportMetrics {
  total: number;
  open: number;
  waitingSeller: number;
  waitingBuyer: number;
  highPriority: number;
  stale: number;
  closed: number;
}

interface SellerProductSupportWorkspaceProps {
  productId: string;
  productTitle: string;
  productSlug: string;
  activeReleaseVersion: string | null;
  selectedStatus: SupportTicketStatus | "all";
  tickets: SellerProductSupportTicketItem[];
  metrics: SellerProductSupportMetrics;
}

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Abierto",
  waiting_seller: "Esperando seller",
  waiting_buyer: "Esperando buyer",
  closed: "Cerrado",
};

function statusTone(status: SupportTicketStatus) {
  switch (status) {
    case "waiting_seller":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "waiting_buyer":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "closed":
      return "border-white/10 bg-white/5 text-[var(--text-soft)]";
    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
}

function priorityTone(priority: SupportTicketPriority) {
  return priority === "high"
    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
    : "border-white/10 bg-white/5 text-[var(--text-soft)]";
}

function truncate(value: string | null, maxLength = 140) {
  if (!value) {
    return "Aun no hay mensajes en este ticket.";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function waitingLabel(status: SupportTicketStatus) {
  switch (status) {
    case "waiting_seller":
      return "Tu equipo debe responder";
    case "waiting_buyer":
      return "Esperando buyer";
    case "closed":
      return "Ticket cerrado";
    default:
      return "Conversacion abierta";
  }
}

function supportFilterHref(productId: string, status: SupportTicketStatus | "all") {
  return status === "all"
    ? `/seller/products/${productId}/support`
    : `/seller/products/${productId}/support?status=${status}`;
}

export function SellerProductSupportWorkspace({
  productId,
  productTitle,
  productSlug,
  activeReleaseVersion,
  selectedStatus,
  tickets,
  metrics,
}: SellerProductSupportWorkspaceProps) {
  const emptyMessage =
    selectedStatus === "all"
      ? "Todavia no hay tickets para este producto."
      : "No hay tickets en este estado para este producto.";

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_rgba(255,255,255,0.03)_40%,_rgba(0,0,0,0.2)_100%)] p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
              Product Support
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">{productTitle}</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
              Cola operativa de soporte por producto. Aqui ves que tickets estan abiertos, quien
              espera respuesta y como encajan con la release viva del producto.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge className="border-white/10 bg-white/5 text-[var(--text-soft)]">
                Release activa: {activeReleaseVersion ? `v${activeReleaseVersion}` : "Sin activa"}
              </Badge>
              <Badge
                className={
                  metrics.waitingSeller > 0
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                }
              >
                {metrics.waitingSeller > 0
                  ? `${metrics.waitingSeller} esperando seller`
                  : "Sin deuda inmediata de respuesta"}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/seller/products/${productId}`}>
              <Button variant="ghost">Volver al workspace</Button>
            </Link>
            <Link href={`/products/${productSlug}`}>
              <Button variant="ghost">Ver ficha publica</Button>
            </Link>
            <Link href="/support?view=seller">
              <Button variant="secondary">Cola global seller</Button>
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Total</p>
            <p className="mt-2 text-2xl font-bold text-white">{metrics.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-amber-200">Esperando seller</p>
            <p className="mt-2 text-2xl font-bold text-white">{metrics.waitingSeller}</p>
          </div>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-sky-200">Esperando buyer</p>
            <p className="mt-2 text-2xl font-bold text-white">{metrics.waitingBuyer}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-rose-200">Alta prioridad</p>
            <p className="mt-2 text-2xl font-bold text-white">{metrics.highPriority}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Abiertos</p>
            <p className="mt-2 text-2xl font-bold text-white">{metrics.open}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Cerrados</p>
            <p className="mt-2 text-2xl font-bold text-white">{metrics.closed}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Tickets del producto</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Cola privada del producto con contexto de ultima actividad, prioridad y quien espera
              respuesta.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={supportFilterHref(productId, "all")}>
              <Button variant={selectedStatus === "all" ? "secondary" : "ghost"}>Todos</Button>
            </Link>
            <Link href={supportFilterHref(productId, "waiting_seller")}>
              <Button variant={selectedStatus === "waiting_seller" ? "secondary" : "ghost"}>
                Esperando seller
              </Button>
            </Link>
            <Link href={supportFilterHref(productId, "waiting_buyer")}>
              <Button variant={selectedStatus === "waiting_buyer" ? "secondary" : "ghost"}>
                Esperando buyer
              </Button>
            </Link>
            <Link href={supportFilterHref(productId, "closed")}>
              <Button variant={selectedStatus === "closed" ? "secondary" : "ghost"}>
                Cerrados
              </Button>
            </Link>
          </div>
        </div>

        {tickets.length > 0 ? (
          <div className="mt-6 space-y-4">
            {tickets.map((ticket) => (
              <article
                key={ticket.id}
                className="rounded-2xl border border-white/10 bg-black/10 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">{ticket.subject}</h3>
                      <Badge className={statusTone(ticket.status)}>
                        {STATUS_LABELS[ticket.status]}
                      </Badge>
                      <Badge className={priorityTone(ticket.priority)}>
                        {ticket.priority === "high" ? "Alta prioridad" : "Prioridad normal"}
                      </Badge>
                    </div>

                    <div className="mt-3 grid gap-3 text-sm text-[var(--text-soft)] md:grid-cols-2">
                      <p>
                        Buyer: <span className="text-white">{ticket.buyerLabel}</span>
                      </p>
                      <p>
                        Estado operativo:{" "}
                        <span className="text-white">{waitingLabel(ticket.status)}</span>
                      </p>
                      <p>
                        Ultima actividad:{" "}
                        <span className="text-white">
                          {new Date(ticket.last_message_at).toLocaleString("es-ES")}
                        </span>
                      </p>
                      <p>
                        Ultima respuesta:{" "}
                        <span className="text-white">
                          {ticket.lastMessageAuthorLabel || "Sin mensajes"}
                        </span>
                      </p>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                        Ultimo mensaje
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
                        {truncate(ticket.lastMessageBody)}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-[220px] space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[var(--text-soft)]">
                      <p className="font-semibold text-white">Contexto del producto</p>
                      <p className="mt-2">
                        Release viva: <span className="text-white">{activeReleaseVersion ? `v${activeReleaseVersion}` : "Sin activa"}</span>
                      </p>
                      <p className="mt-1">
                        Ticket creado:{" "}
                        <span className="text-white">
                          {new Date(ticket.created_at).toLocaleDateString("es-ES")}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link href={`/support/tickets/${ticket.id}?workspaceProductId=${productId}`}>
                        <Button variant="secondary">Abrir ticket</Button>
                      </Link>
                      <Link href={`/products/${productSlug}`}>
                        <Button variant="ghost">Ver producto</Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">{emptyMessage}</p>
          </div>
        )}
      </section>
    </div>
  );
}
