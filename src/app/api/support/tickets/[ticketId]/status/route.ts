import { NextResponse } from "next/server";
import { createUserNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{
    ticketId: string;
  }>;
}

type TicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";

export async function POST(request: Request, { params }: RouteContext) {
  const { ticketId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | { status?: TicketStatus }
    | null;

  const nextStatus = payload?.status;

  if (!nextStatus || !["open", "waiting_seller", "waiting_buyer", "closed"].includes(nextStatus)) {
    return NextResponse.json({ message: "Estado de ticket invalido" }, { status: 400 });
  }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, buyer_user_id, vendor_id, subject")
    .eq("id", ticketId)
    .single();

  if (!ticket) {
    return NextResponse.json({ message: "Ticket no encontrado" }, { status: 404 });
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("user_id")
    .eq("id", ticket.vendor_id)
    .maybeSingle();

  const isBuyer = ticket.buyer_user_id === user.id;
  const isSeller = vendor?.user_id === user.id;

  if (!isBuyer && !isSeller) {
    return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
  }

  if (nextStatus === "closed" && !isBuyer && !isSeller) {
    return NextResponse.json({ message: "No puedes cerrar este ticket" }, { status: 403 });
  }

  if (nextStatus === "open" && !isBuyer && !isSeller) {
    return NextResponse.json({ message: "No puedes reabrir este ticket" }, { status: 403 });
  }

  const { error } = await supabase
    .from("support_tickets")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticket.id);

  if (error) {
    return NextResponse.json(
      { message: error.message || "No se pudo actualizar el ticket" },
      { status: 500 }
    );
  }

  const recipientUserId = isSeller ? ticket.buyer_user_id : vendor?.user_id;

  if (recipientUserId) {
    await createUserNotification({
      recipientUserId,
      actorUserId: user.id,
      kind: "support_ticket_status_changed",
      title: nextStatus === "closed" ? "Ticket cerrado" : "Ticket reabierto",
      body: ticket.subject,
      href: `/support/tickets/${ticket.id}`,
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: {
        status: nextStatus,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
