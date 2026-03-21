import type { Json } from "@/types/database";

export type DisputeStatus = "open" | "reviewing" | "resolved" | "rejected";
export type LicenseStatus = "active" | "revoked";
export type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";

export interface DisputeCaseRecord {
  id: string;
  order_id: string | null;
  license_id: string | null;
  product_id: string | null;
  opened_by_user_id: string;
  assigned_admin_user_id: string | null;
  status: DisputeStatus;
  reason: string;
  created_at: string;
  updated_at: string;
}

interface ProductRecord {
  id: string;
  title: string;
  slug: string;
  vendor_id: string;
  refund_policy: string | null;
}

interface VendorRecord {
  id: string;
  store_name: string;
  slug: string | null;
}

interface OrderRecord {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  total_cents: number;
}

interface LicenseRecord {
  status: LicenseStatus;
  license_key: string;
  issued_at: string;
  last_validated_at: string | null;
}

interface SupportTicketRecord {
  id: string;
  product_id: string;
  buyer_user_id: string;
  subject: string;
  status: SupportTicketStatus;
  priority: "normal" | "high";
  updated_at: string;
  last_message_at: string;
}

interface AuditLogRecord {
  id: string;
  actor_user_id: string | null;
  action: string;
  metadata: Json | null;
  created_at: string;
}

interface ProfileRecord {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
}

export interface DisputeCaseDetail {
  dispute: DisputeCaseRecord;
  product: ProductRecord | null;
  vendor: VendorRecord | null;
  order: OrderRecord | null;
  license: LicenseRecord | null;
  supportTickets: SupportTicketRecord[];
  latestSupportTicket: SupportTicketRecord | null;
  auditLogs: AuditLogRecord[];
  buyerProfile: ProfileRecord | null;
  assignedAdminProfile: ProfileRecord | null;
}

export interface BuyerDisputeCaseDetail {
  dispute: Pick<DisputeCaseRecord, "id" | "status" | "reason" | "created_at" | "updated_at">;
  product: ProductRecord | null;
  vendor: VendorRecord | null;
  order: OrderRecord | null;
  license: LicenseRecord | null;
  supportTickets: SupportTicketRecord[];
  latestSupportTicket: SupportTicketRecord | null;
  auditLogs: AuditLogRecord[];
  assignedAdminProfile: ProfileRecord | null;
}

export function disputeStatusLabel(status: DisputeStatus) {
  switch (status) {
    case "open":
      return "Abierta";
    case "reviewing":
      return "En revision";
    case "resolved":
      return "Resuelta";
    case "rejected":
      return "Rechazada";
  }
}

export function disputeStatusTone(status: DisputeStatus) {
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

export function disputeNextActionLabel(status: DisputeStatus, viewer: "buyer" | "admin") {
  if (viewer === "admin") {
    switch (status) {
      case "open":
        return "Tomar revision y decidir si el caso necesita resolucion o rechazo.";
      case "reviewing":
        return "Resolver o rechazar con criterio operativo y trazabilidad.";
      case "resolved":
        return "Caso cerrado. Solo reabrir si aparece nueva evidencia.";
      case "rejected":
        return "Caso rechazado. Solo reabrir si la decision cambia.";
    }
  }

  switch (status) {
    case "open":
      return "Tu caso esta abierto y pendiente de ser tomado por el equipo.";
    case "reviewing":
      return "El marketplace ya esta revisando la incidencia.";
    case "resolved":
      return "La disputa ya fue resuelta. Revisa pedido, licencia y resultado.";
    case "rejected":
      return "La disputa fue rechazada. Si el problema persiste, vuelve por soporte.";
  }
}

export function disputeActorLabel(status: DisputeStatus) {
  switch (status) {
    case "open":
      return "Marketplace pendiente de tomar revision";
    case "reviewing":
      return "Marketplace revisando el caso";
    case "resolved":
      return "Caso cerrado por admin";
    case "rejected":
      return "Caso rechazado por admin";
  }
}

export function formatProfileLabel(profile: ProfileRecord | null, fallback: string) {
  return profile?.display_name || profile?.username || profile?.email || fallback;
}

function sanitizeBuyerAuditMetadata(value: Json | null): Json | null {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeBuyerAuditMetadata(item as Json))
      .filter((item) => item !== null) as Json;
  }

  const hiddenKeys = new Set([
    "license_id",
    "product_id",
    "vendor_id",
    "buyer_user_id",
    "assigned_admin_user_id",
    "actor_user_id",
  ]);

  const nextEntries = Object.entries(value)
    .filter(([key]) => !hiddenKeys.has(key))
    .map(([key, nestedValue]) => [key, sanitizeBuyerAuditMetadata(nestedValue as Json)]);

  return Object.fromEntries(nextEntries) as Json;
}

export async function getDisputeCaseDetail(
  supabase: {
    from: (table: string) => any;
  },
  disputeId: string
): Promise<DisputeCaseDetail | null> {
  const { data: dispute } = (await supabase
    .from("disputes")
    .select(
      "id, order_id, license_id, product_id, opened_by_user_id, assigned_admin_user_id, status, reason, created_at, updated_at"
    )
    .eq("id", disputeId)
    .maybeSingle()) as { data: DisputeCaseRecord | null };

  if (!dispute) {
    return null;
  }

  const [productResult, orderResult, licenseResult, supportResult, auditResult, profilesResult] =
    await Promise.all([
      dispute.product_id
        ? supabase
            .from("products")
            .select("id, title, slug, vendor_id, refund_policy")
            .eq("id", dispute.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null as ProductRecord | null }),
      dispute.order_id
        ? supabase
            .from("orders")
            .select("id, user_id, status, created_at, total_cents")
            .eq("id", dispute.order_id)
            .maybeSingle()
        : Promise.resolve({ data: null as OrderRecord | null }),
      dispute.license_id
        ? supabase
            .from("licenses")
            .select("status, license_key, issued_at, last_validated_at")
            .eq("id", dispute.license_id)
            .maybeSingle()
        : Promise.resolve({ data: null as LicenseRecord | null }),
      dispute.product_id
        ? supabase
            .from("support_tickets")
            .select("id, product_id, buyer_user_id, subject, status, priority, updated_at, last_message_at")
            .eq("buyer_user_id", dispute.opened_by_user_id)
            .eq("product_id", dispute.product_id)
            .order("last_message_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] as SupportTicketRecord[] }),
      supabase
        .from("audit_logs")
        .select("id, actor_user_id, action, metadata, created_at")
        .eq("entity_type", "dispute")
        .eq("entity_id", dispute.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, display_name, username, email")
        .in(
          "id",
          [dispute.opened_by_user_id, dispute.assigned_admin_user_id]
            .filter(Boolean) as string[]
        ),
    ]);

  const product = (productResult.data || null) as ProductRecord | null;

  const { data: vendor } =
    product?.vendor_id
      ? ((await supabase
          .from("vendors")
          .select("id, store_name, slug")
          .eq("id", product.vendor_id)
          .maybeSingle()) as { data: VendorRecord | null })
      : { data: null as VendorRecord | null };

  const profiles = (profilesResult.data || []) as ProfileRecord[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const supportTickets = (supportResult.data || []) as SupportTicketRecord[];

  return {
    dispute,
    product,
    vendor,
    order: (orderResult.data || null) as OrderRecord | null,
    license: (licenseResult.data || null) as LicenseRecord | null,
    supportTickets,
    latestSupportTicket: supportTickets[0] || null,
    auditLogs: (auditResult.data || []) as AuditLogRecord[],
    buyerProfile: profileById.get(dispute.opened_by_user_id) || null,
    assignedAdminProfile: dispute.assigned_admin_user_id
      ? profileById.get(dispute.assigned_admin_user_id) || null
      : null,
  };
}

export async function getBuyerDisputeCaseDetail(
  supabase: {
    from: (table: string) => any;
  },
  disputeId: string,
  buyerUserId: string
): Promise<BuyerDisputeCaseDetail | null> {
  const { data: dispute } = (await supabase
    .from("disputes")
    .select(
      "id, order_id, license_id, product_id, opened_by_user_id, assigned_admin_user_id, status, reason, created_at, updated_at"
    )
    .eq("id", disputeId)
    .eq("opened_by_user_id", buyerUserId)
    .maybeSingle()) as { data: DisputeCaseRecord | null };

  if (!dispute) {
    return null;
  }

  const [productResult, orderResult, licenseResult, supportResult, auditResult, profilesResult] =
    await Promise.all([
      dispute.product_id
        ? supabase
            .from("products")
            .select("id, title, slug, vendor_id, refund_policy")
            .eq("id", dispute.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null as ProductRecord | null }),
      dispute.order_id
        ? supabase
            .from("orders")
            .select("id, user_id, status, created_at, total_cents")
            .eq("id", dispute.order_id)
            .maybeSingle()
        : Promise.resolve({ data: null as OrderRecord | null }),
      dispute.license_id
        ? supabase
            .from("licenses")
            .select("status, license_key, issued_at, last_validated_at")
            .eq("id", dispute.license_id)
            .maybeSingle()
        : Promise.resolve({ data: null as LicenseRecord | null }),
      dispute.product_id
        ? supabase
            .from("support_tickets")
            .select("id, product_id, buyer_user_id, subject, status, priority, updated_at, last_message_at")
            .eq("buyer_user_id", buyerUserId)
            .eq("product_id", dispute.product_id)
            .order("last_message_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] as SupportTicketRecord[] }),
      supabase
        .from("audit_logs")
        .select("id, actor_user_id, action, metadata, created_at")
        .eq("entity_type", "dispute")
        .eq("entity_id", dispute.id)
        .order("created_at", { ascending: true }),
      dispute.assigned_admin_user_id
        ? supabase
            .from("profiles")
            .select("id, display_name, username, email")
            .eq("id", dispute.assigned_admin_user_id)
            .maybeSingle()
        : Promise.resolve({ data: null as ProfileRecord | null }),
    ]);

  const product = (productResult.data || null) as ProductRecord | null;
  const { data: vendor } =
    product?.vendor_id
      ? ((await supabase
          .from("vendors")
          .select("id, store_name, slug")
          .eq("id", product.vendor_id)
          .maybeSingle()) as { data: VendorRecord | null })
      : { data: null as VendorRecord | null };
  const supportTickets = (supportResult.data || []) as SupportTicketRecord[];

  return {
    dispute: {
      id: dispute.id,
      status: dispute.status,
      reason: dispute.reason,
      created_at: dispute.created_at,
      updated_at: dispute.updated_at,
    },
    product,
    vendor: vendor || null,
    order: (orderResult.data || null) as OrderRecord | null,
    license: (licenseResult.data || null) as LicenseRecord | null,
    supportTickets,
    latestSupportTicket: supportTickets[0] || null,
    auditLogs: ((auditResult.data || []) as AuditLogRecord[]).map((entry) => ({
      ...entry,
      actor_user_id: entry.actor_user_id ? "Marketplace" : null,
      metadata: sanitizeBuyerAuditMetadata(entry.metadata),
    })),
    assignedAdminProfile: (profilesResult.data || null) as ProfileRecord | null,
  };
}
