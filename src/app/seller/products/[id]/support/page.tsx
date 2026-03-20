import { SiteHeaderServer } from "@/components/layout/site-header-server";
import {
  SellerProductSupportWorkspace,
  type SellerProductSupportTicketItem,
} from "@/components/seller/seller-product-support-workspace";
import { requireOwnedProductContext } from "@/lib/auth/seller";

type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";

interface SupportTicketRow {
  id: string;
  buyer_user_id: string;
  subject: string;
  status: SupportTicketStatus;
  priority: "normal" | "high";
  created_at: string;
  updated_at: string;
  last_message_at: string;
}

interface SupportMessageRow {
  ticket_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string;
}

function normalizeStatus(value: string | undefined): SupportTicketStatus | "all" {
  if (value === "open" || value === "waiting_seller" || value === "waiting_buyer" || value === "closed") {
    return value;
  }

  return "all";
}

interface SellerProductSupportPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    status?: string;
  }>;
}

export default async function SellerProductSupportPage({
  params,
  searchParams,
}: SellerProductSupportPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const selectedStatus = normalizeStatus(resolvedSearchParams.status);
  const { supabase, vendor, product } = await requireOwnedProductContext(id);

  const [ticketsResult, activeReleaseResult] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id, buyer_user_id, subject, status, priority, created_at, updated_at, last_message_at")
      .eq("product_id", product.id)
      .eq("vendor_id", vendor.id)
      .order("priority", { ascending: false })
      .order("last_message_at", { ascending: false }),
    supabase
      .from("product_versions")
      .select("version")
      .eq("product_id", product.id)
      .eq("release_status", "active")
      .maybeSingle(),
  ]);

  const allTickets = (ticketsResult.data || []) as SupportTicketRow[];
  const ticketIds = Array.from(new Set(allTickets.map((ticket) => ticket.id)));
  const buyerIds = Array.from(new Set(allTickets.map((ticket) => ticket.buyer_user_id)));

  const [messagesResult, buyersResult] = await Promise.all([
    ticketIds.length
      ? supabase
          .from("support_messages")
          .select("ticket_id, sender_user_id, body, created_at")
          .in("ticket_id", ticketIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as SupportMessageRow[] }),
    buyerIds.length
      ? supabase
          .from("profiles")
          .select("id, display_name, username, email")
          .in("id", buyerIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
  ]);

  const latestMessageByTicketId = new Map<string, SupportMessageRow>();
  ((messagesResult.data || []) as SupportMessageRow[]).forEach((message) => {
    if (!latestMessageByTicketId.has(message.ticket_id)) {
      latestMessageByTicketId.set(message.ticket_id, message);
    }
  });

  const buyerById = new Map(
    ((buyersResult.data || []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );

  const metrics = {
    total: allTickets.length,
    open: allTickets.filter((ticket) => ticket.status === "open").length,
    waitingSeller: allTickets.filter((ticket) => ticket.status === "waiting_seller").length,
    waitingBuyer: allTickets.filter((ticket) => ticket.status === "waiting_buyer").length,
    highPriority: allTickets.filter((ticket) => ticket.priority === "high").length,
    stale: 0,
    closed: allTickets.filter((ticket) => ticket.status === "closed").length,
  };

  const detailedTickets: SellerProductSupportTicketItem[] = allTickets.map((ticket) => {
    const buyer = buyerById.get(ticket.buyer_user_id);
    const lastMessage = latestMessageByTicketId.get(ticket.id);
    const buyerLabel =
      buyer?.display_name || buyer?.username || buyer?.email || "Buyer";

    let lastMessageAuthorLabel: string | null = null;
    if (lastMessage) {
      lastMessageAuthorLabel =
        lastMessage.sender_user_id === vendor.user_id ? "Seller" : buyerLabel;
    }

    return {
      ...ticket,
      buyerLabel,
      lastMessageBody: lastMessage?.body || null,
      lastMessageAuthorLabel,
      lastMessageCreatedAt: lastMessage?.created_at || null,
    };
  });

  const tickets = detailedTickets.filter((ticket) =>
    selectedStatus === "all" ? true : ticket.status === selectedStatus
  );

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <SellerProductSupportWorkspace
          productId={product.id}
          productTitle={product.title}
          productSlug={product.slug}
          activeReleaseVersion={activeReleaseResult.data?.version || null}
          selectedStatus={selectedStatus}
          tickets={tickets}
          metrics={metrics}
        />
      </section>
    </main>
  );
}
