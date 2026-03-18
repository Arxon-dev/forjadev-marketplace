"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface SellerSupportQueueProps {
  vendorId: string;
  statusFilter?: SupportTicketRow["status"] | "all";
}

interface SupportTicketRow {
  id: string;
  product_id: string;
  subject: string;
  status: "open" | "waiting_seller" | "waiting_buyer" | "closed";
  priority: "normal" | "high";
  created_at: string;
  last_message_at: string;
  updated_at: string;
}

interface ProductRow {
  id: string;
  title: string;
}

interface SupportMessageRow {
  ticket_id: string;
  sender_user_id: string;
  created_at: string;
}

interface SupportMetrics {
  total: number;
  waitingSeller: number;
  highPriority: number;
  stale: number;
  closed: number;
  firstResponseHours: number | null;
}

const STATUS_LABELS: Record<SupportTicketRow["status"], string> = {
  open: "Abierto",
  waiting_seller: "Esperando seller",
  waiting_buyer: "Esperando buyer",
  closed: "Cerrado",
};

function hoursBetween(start: string, end: string) {
  return (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
}

function formatHours(hours: number | null) {
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

function getSlaTone(hours: number | null) {
  if (hours === null) {
    return "text-[var(--text-soft)]";
  }

  if (hours <= 4) {
    return "text-emerald-300";
  }

  if (hours <= 12) {
    return "text-amber-300";
  }

  return "text-rose-300";
}

export function SellerSupportQueue({
  vendorId,
  statusFilter = "all",
}: SellerSupportQueueProps) {
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [productById, setProductById] = useState<Map<string, ProductRow>>(new Map());
  const [metrics, setMetrics] = useState<SupportMetrics>({
    total: 0,
    waitingSeller: 0,
    highPriority: 0,
    stale: 0,
    closed: 0,
    firstResponseHours: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!vendorId) {
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data: vendor } = await supabase
        .from("vendors")
        .select("user_id")
        .eq("id", vendorId)
        .maybeSingle();

      const { data: ticketsData } = await supabase
        .from("support_tickets")
        .select("id, product_id, subject, status, priority, created_at, last_message_at, updated_at")
        .eq("vendor_id", vendorId)
        .order("priority", { ascending: false })
        .order("last_message_at", { ascending: false })
        .limit(20);

      const allTickets = (ticketsData || []) as SupportTicketRow[];

      const filteredTickets =
        statusFilter === "all"
          ? allTickets
          : allTickets.filter((ticket) => ticket.status === statusFilter);

      const productIds = Array.from(
        new Set(filteredTickets.map((ticket) => ticket.product_id))
      );

      const ticketIds = Array.from(new Set(allTickets.map((ticket) => ticket.id)));
      const { data: products } = productIds.length
        ? await supabase.from("products").select("id, title").in("id", productIds)
        : { data: [] as ProductRow[] };

      const { data: messages } = ticketIds.length
        ? await supabase
            .from("support_messages")
            .select("ticket_id, sender_user_id, created_at")
            .in("ticket_id", ticketIds)
            .order("created_at", { ascending: true })
        : { data: [] as SupportMessageRow[] };

      const firstResponseSamples =
        vendor?.user_id && messages
          ? allTickets
              .map((ticket) => {
                const ticketMessages = messages.filter((message) => message.ticket_id === ticket.id);
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
              .filter((value): value is number => value !== null)
          : [];

      const nowIso = new Date().toISOString();
      const firstResponseHours =
        firstResponseSamples.length > 0
          ? firstResponseSamples.reduce((sum, value) => sum + value, 0) / firstResponseSamples.length
          : null;

      setMetrics({
        total: allTickets.length,
        waitingSeller: allTickets.filter((ticket) => ticket.status === "waiting_seller").length,
        highPriority: allTickets.filter((ticket) => ticket.priority === "high").length,
        stale: allTickets.filter(
          (ticket) =>
            ticket.status !== "closed" && hoursBetween(ticket.last_message_at, nowIso) >= 24
        ).length,
        closed: allTickets.filter((ticket) => ticket.status === "closed").length,
        firstResponseHours,
      });

      setTickets(filteredTickets as SupportTicketRow[]);
      setProductById(new Map((products || []).map((product) => [product.id, product])));
      setLoading(false);
    };

    load();
  }, [statusFilter, vendorId]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Soporte reciente</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Tickets recientes que requieren seguimiento desde tu panel seller.
          </p>
        </div>
        <Link href="/support?view=seller">
          <Button variant="secondary">Centro de soporte</Button>
        </Link>
      </div>

      {!loading ? (
        <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Total
            </p>
            <p className="mt-2 text-2xl font-bold text-white">{metrics.total}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-amber-200">
              Esperando seller
            </p>
            <p className="mt-2 text-2xl font-bold text-white">{metrics.waitingSeller}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-rose-200">
              Alta prioridad
            </p>
            <p className="mt-2 text-2xl font-bold text-white">{metrics.highPriority}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              Sin respuesta +24h
            </p>
            <p className="mt-2 text-2xl font-bold text-white">{metrics.stale}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
              SLA primera respuesta
            </p>
            <p className={`mt-2 text-2xl font-bold ${getSlaTone(metrics.firstResponseHours)}`}>
              {formatHours(metrics.firstResponseHours)}
            </p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-[var(--text-soft)]">Cargando soporte...</p>
      ) : tickets.length > 0 ? (
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
                  <p className="mt-2 text-xs text-[var(--text-soft)]">
                    Ultima actividad: {new Date(ticket.updated_at).toLocaleString("es-ES")}
                  </p>
                </div>
                <div className="text-right text-xs text-[var(--text-soft)]">
                  <p>{STATUS_LABELS[ticket.status]}</p>
                  <p>{ticket.priority === "high" ? "Alta prioridad" : "Prioridad normal"}</p>
                  <p className="mt-2">
                    {hoursBetween(ticket.last_message_at, new Date().toISOString()) >= 24
                      ? "SLA en riesgo"
                      : "Dentro de SLA"}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Link href={`/support/tickets/${ticket.id}`}>
                  <Button variant="ghost">Abrir ticket</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[var(--text-soft)]">Todavia no tienes tickets abiertos.</p>
      )}
    </div>
  );
}
