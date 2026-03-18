import { NextResponse } from "next/server";
import { createUserNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{
    ticketId: string;
  }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { ticketId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { body?: string } | null;
  const body = payload?.body?.trim();

  if (!body) {
    return NextResponse.json({ message: "El mensaje no puede estar vacio" }, { status: 400 });
  }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, buyer_user_id, vendor_id, product_id, subject, status")
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

  const { data: product } = await supabase
    .from("products")
    .select("title")
    .eq("id", ticket.product_id)
    .maybeSingle();

  const isBuyer = ticket.buyer_user_id === user.id;
  const isSeller = vendor?.user_id === user.id;

  if (!isBuyer && !isSeller) {
    return NextResponse.json({ message: "Acceso denegado" }, { status: 403 });
  }

  const { error: messageError } = await supabase.from("support_messages").insert([
    {
      ticket_id: ticket.id,
      sender_user_id: user.id,
      body,
    },
  ]);

  if (messageError) {
    return NextResponse.json(
      { message: messageError.message || "No se pudo guardar el mensaje" },
      { status: 500 }
    );
  }

  const nextStatus = isSeller ? "waiting_buyer" : "waiting_seller";
  const { error: ticketError } = await supabase
    .from("support_tickets")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticket.id);

  if (ticketError) {
    return NextResponse.json(
      { message: ticketError.message || "Mensaje guardado pero no se pudo actualizar el ticket" },
      { status: 500 }
    );
  }

  const recipientUserId = isSeller ? ticket.buyer_user_id : vendor?.user_id;
  const productTitle = product?.title || "Producto";

  if (recipientUserId) {
    await createUserNotification({
      recipientUserId,
      actorUserId: user.id,
      kind: "support_message_received",
      title: isSeller ? "Nueva respuesta del seller" : "Nueva respuesta del buyer",
      body: `${ticket.subject} · ${productTitle}`,
      href: `/support/tickets/${ticket.id}`,
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: {
        nextStatus,
        productTitle,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
