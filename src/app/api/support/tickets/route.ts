import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createUserNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Necesitas iniciar sesion" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        productId?: string;
        subject?: string;
        message?: string;
        priority?: "normal" | "high";
      }
    | null;

  const productId = payload?.productId;
  const subject = payload?.subject?.trim();
  const message = payload?.message?.trim();
  const priority = payload?.priority === "high" ? "high" : "normal";

  if (!productId || !subject || !message) {
    return NextResponse.json(
      { message: "Debes indicar producto, asunto y mensaje" },
      { status: 400 }
    );
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, vendor_id, title, is_free, moderation_status")
    .eq("id", productId)
    .single();

  if (!product || product.moderation_status !== "approved") {
    return NextResponse.json({ message: "Producto no disponible" }, { status: 404 });
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("user_id")
    .eq("id", product.vendor_id)
    .single();

  if (vendor?.user_id === user.id) {
    return NextResponse.json(
      { message: "No puedes abrir soporte sobre tu propio producto" },
      { status: 403 }
    );
  }

  let hasAccess = false;

  if (product.is_free) {
    const { data: download } = await supabase
      .from("downloads")
      .select("id")
      .eq("product_id", product.id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    hasAccess = Boolean(download);
  } else {
    const { data: purchase } = await supabase
      .from("order_items")
      .select("id, order:orders!inner(status, user_id)")
      .eq("product_id", product.id)
      .eq("order.user_id", user.id)
      .eq("order.status", "completed")
      .limit(1)
      .maybeSingle();

    hasAccess = Boolean(purchase);
  }

  if (!hasAccess) {
    return NextResponse.json(
      { message: "Solo puedes abrir soporte para productos adquiridos" },
      { status: 403 }
    );
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert([
      {
        product_id: product.id,
        vendor_id: product.vendor_id,
        buyer_user_id: user.id,
        subject,
        status: "waiting_seller",
        priority,
      },
    ])
    .select("id")
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json(
      { message: ticketError?.message || "No se pudo crear el ticket" },
      { status: 500 }
    );
  }

  const { error: messageError } = await supabase.from("support_messages").insert([
    {
      ticket_id: ticket.id,
      sender_user_id: user.id,
      body: message,
    },
  ]);

  if (messageError) {
    await supabase.from("support_tickets").delete().eq("id", ticket.id);

    return NextResponse.json(
      { message: messageError.message || "No se pudo guardar el mensaje inicial" },
      { status: 500 }
    );
  }

  if (vendor?.user_id) {
    await createUserNotification({
      recipientUserId: vendor.user_id,
      actorUserId: user.id,
      kind: "support_ticket_created",
      title: "Nuevo ticket de soporte",
      body: `${subject} · ${product.title}`,
      href: `/support/tickets/${ticket.id}`,
      entityType: "support_ticket",
      entityId: ticket.id,
      metadata: {
        productId: product.id,
        productTitle: product.title,
        priority,
      },
    });
  }

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
