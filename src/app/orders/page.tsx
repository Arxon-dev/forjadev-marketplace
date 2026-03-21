import Link from "next/link";
import { redirect } from "next/navigation";
import { DisputeForm } from "@/components/community/dispute-form";
import { DownloadButton } from "@/components/downloads/download-button";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { BuyerPostSaleClarityCard } from "@/components/post-sale/buyer-post-sale-clarity-card";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDownloadAccess } from "@/lib/downloads/access";
import { buildBuyerPostSaleTransparencySnapshot } from "@/lib/post-sale/buyer-transparency";
import { createClient } from "@/lib/supabase/server";

type LicenseStatus = "active" | "revoked";

interface ProductRow {
  id: string;
  title: string;
  slug: string;
  is_free?: boolean;
  refund_policy?: string | null;
}

interface LicenseRow {
  id: string;
  license_key: string;
  status: LicenseStatus;
  issued_at: string;
}

interface OrderItemRow {
  id: string;
  price_cents: number;
  product: ProductRow | ProductRow[] | null;
  license: LicenseRow | LicenseRow[] | null;
}

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  total_cents: number;
  items: OrderItemRow[] | null;
}

interface DownloadRow {
  product_id: string;
  downloaded_at: string;
}

interface SupportTicketRow {
  product_id: string;
  status: "open" | "waiting_seller" | "waiting_buyer" | "closed";
}

interface DisputeRow {
  product_id: string | null;
  status: string;
}

interface OrdersPageProps {
  searchParams?: Promise<{
    highlightOrder?: string;
  }>;
}

type DownloadAccessSnapshot = Awaited<ReturnType<typeof resolveDownloadAccess>>;

function formatCurrency(cents: number) {
  return cents === 0 ? "Gratis" : `EUR ${(cents / 100).toFixed(2)}`;
}

function accessBadgeTone(access: DownloadAccessSnapshot) {
  if (access.ok) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (access.message.includes("revocada")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }

  return "border-rose-500/30 bg-rose-500/10 text-rose-300";
}

function accessLabel(access: DownloadAccessSnapshot) {
  if (access.ok) {
    return "Descarga disponible";
  }

  if (access.message.includes("revocada")) {
    return "Licencia revocada";
  }

  if (access.message.includes("release activa")) {
    return "Esperando release";
  }

  return "Acceso bloqueado";
}

function supportSummary(tickets: SupportTicketRow[]) {
  const openCount = tickets.filter((ticket) => ticket.status !== "closed").length;
  const waitingSeller = tickets.filter((ticket) => ticket.status === "waiting_seller").length;

  if (openCount === 0) {
    return "Sin tickets abiertos";
  }

  if (waitingSeller > 0) {
    return `${waitingSeller} esperando seller`;
  }

  return `${openCount} tickets abiertos`;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const resolvedSearchParams = (await searchParams) || {};
  const highlightOrderId = resolvedSearchParams.highlightOrder || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, created_at, status, total_cents, items:order_items(id, price_cents, product:products(id, title, slug, is_free, refund_policy), license:licenses(id, license_key, status, issued_at))"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const orderRows = (orders || []) as OrderRow[];
  const highlightedOrder = highlightOrderId
    ? orderRows.find((order) => order.id === highlightOrderId) || null
    : null;

  const productIds = Array.from(
    new Set(
      orderRows.flatMap((order) =>
        (order.items || [])
          .map((item) => {
            const product = Array.isArray(item.product) ? item.product[0] : item.product;
            return product?.id || null;
          })
          .filter(Boolean) as string[]
      )
    )
  );

  const [downloadsResult, supportTicketsResult, disputesResult] = await Promise.all([
    productIds.length
      ? supabase
          .from("downloads")
          .select("product_id, downloaded_at")
          .eq("user_id", user.id)
          .in("product_id", productIds)
          .order("downloaded_at", { ascending: false })
      : Promise.resolve({ data: [] as DownloadRow[] }),
    productIds.length
      ? supabase
          .from("support_tickets")
          .select("product_id, status")
          .eq("buyer_user_id", user.id)
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as SupportTicketRow[] }),
    productIds.length
      ? supabase
          .from("disputes")
          .select("product_id, status")
          .eq("opened_by_user_id", user.id)
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as DisputeRow[] }),
  ]);

  const lastDownloadByProductId = new Map<string, DownloadRow>();
  ((downloadsResult.data || []) as DownloadRow[]).forEach((download) => {
    if (!lastDownloadByProductId.has(download.product_id)) {
      lastDownloadByProductId.set(download.product_id, download);
    }
  });

  const supportByProductId = new Map<string, SupportTicketRow[]>();
  ((supportTicketsResult.data || []) as SupportTicketRow[]).forEach((ticket) => {
    supportByProductId.set(ticket.product_id, [
      ...(supportByProductId.get(ticket.product_id) || []),
      ticket,
    ]);
  });

  const disputesByProductId = new Map<string, DisputeRow[]>();
  ((disputesResult.data || []) as DisputeRow[]).forEach((dispute) => {
    if (!dispute.product_id) {
      return;
    }

    disputesByProductId.set(dispute.product_id, [
      ...(disputesByProductId.get(dispute.product_id) || []),
      dispute,
    ]);
  });

  const adminSupabase = createAdminClient();
  const accessEntries = await Promise.all(
    productIds.map(async (productId) => {
      const access = await resolveDownloadAccess(adminSupabase, user.id, productId);
      return [productId, access] as const;
    })
  );
  const accessByProductId = new Map(accessEntries);

  const totalItems = orderRows.reduce((sum, order) => sum + (order.items || []).length, 0);
  const downloadableItems = productIds.filter((productId) => accessByProductId.get(productId)?.ok).length;
  const blockedItems = productIds.length - downloadableItems;
  const redownloadableItems = productIds.filter((productId) => lastDownloadByProductId.has(productId)).length;

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Orders & Access</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Tu hub de compra y postventa</h1>
        <p className="mt-3 max-w-3xl text-[var(--text-soft)]">
          Aqui cierras el journey completo: confirmacion de compra, acceso real, redescarga,
          licencia, soporte y disputa cuando haga falta.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/licenses" className="text-sm font-semibold text-white hover:underline">
            Ver licencias
          </Link>
          <Link href="/support?view=buyer" className="text-sm font-semibold text-white hover:underline">
            Centro de soporte
          </Link>
          <Link href="/disputes" className="text-sm font-semibold text-white hover:underline">
            Ver disputas
          </Link>
          <Link href="/policies/compras-y-acceso" className="text-sm font-semibold text-white hover:underline">
            Policy de compras
          </Link>
        </div>

        {highlightedOrder ? (
          <div className="mt-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
            <p className="text-sm font-semibold text-emerald-300">Compra completada correctamente.</p>
            <p className="mt-2 text-sm text-emerald-200">
              El pedido #{highlightedOrder.id.slice(0, 8)} ya forma parte de tu biblioteca. Desde
              aqui puedes descargar, revisar licencias y abrir soporte si aparece algun bloqueo.
            </p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Pedidos</p>
            <p className="mt-2 text-3xl font-bold text-white">{orderRows.length}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Items comprados</p>
            <p className="mt-2 text-3xl font-bold text-white">{totalItems}</p>
          </div>
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-200">Acceso disponible</p>
            <p className="mt-2 text-3xl font-bold text-white">{downloadableItems}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Redescargados</p>
            <p className="mt-2 text-3xl font-bold text-white">{redownloadableItems}</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">{blockedItems} con algun bloqueo</p>
          </div>
        </div>

        {orderRows.length > 0 ? (
          <div className="mt-10 space-y-5">
            {orderRows.map((order) => (
              <article key={order.id} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">Pedido #{order.id.slice(0, 8)}</h2>
                      {highlightOrderId === order.id ? (
                        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                          Nuevo
                        </Badge>
                      ) : null}
                      {order.status === "refunded" ? (
                        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                          Pedido reembolsado
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      {new Date(order.created_at).toLocaleString("es-ES")} ·{" "}
                      <span className="capitalize">{order.status}</span>
                    </p>
                  </div>
                  <p className="text-sm font-medium text-white">{formatCurrency(order.total_cents)}</p>
                </div>

                <div className="mt-5 space-y-4">
                  {(order.items || []).map((item) => {
                    const product = Array.isArray(item.product) ? item.product[0] : item.product;
                    const license = Array.isArray(item.license) ? item.license[0] : item.license;
                    const access = product?.id
                      ? accessByProductId.get(product.id) || {
                          ok: false as const,
                          status: 409 as const,
                          message: "No se pudo resolver el acceso de descarga",
                        }
                      : {
                          ok: false as const,
                          status: 404 as const,
                          message: "Producto no encontrado",
                        };
                    const lastDownload = product?.id ? lastDownloadByProductId.get(product.id) || null : null;
                    const supportTickets = product?.id ? supportByProductId.get(product.id) || [] : [];
                    const disputes = product?.id ? disputesByProductId.get(product.id) || [] : [];
                    const openDisputes = disputes.filter((dispute) => dispute.status !== "closed").length;
                    const transparencySnapshot = buildBuyerPostSaleTransparencySnapshot({
                      orderStatus: order.status,
                      accessOk: access.ok,
                      accessMessage: access.ok ? null : access.message,
                      licenseStatus: license?.status || null,
                      hasDownload: Boolean(lastDownload),
                      supportStatuses: supportTickets.map((ticket) => ticket.status),
                      disputeStatuses: disputes
                        .map((dispute) => dispute.status)
                        .filter((status): status is "open" | "reviewing" | "resolved" | "rejected" =>
                          ["open", "reviewing", "resolved", "rejected"].includes(status)
                        ),
                      productRefundPolicy: product?.refund_policy || null,
                    });

                    return (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-black/10 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-white">
                                {product?.title || "Producto"}
                              </h3>
                              <Badge className={accessBadgeTone(access)}>
                                {accessLabel(access)}
                              </Badge>
                              {license ? (
                                <Badge
                                  className={
                                    license.status === "active"
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                      : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                  }
                                >
                                  Licencia {license.status}
                                </Badge>
                              ) : null}
                            </div>

                            <div className="mt-3 grid gap-3 text-sm text-[var(--text-soft)] md:grid-cols-2 xl:grid-cols-4">
                              <p>
                                Precio del item: <span className="text-white">{formatCurrency(item.price_cents)}</span>
                              </p>
                              <p>
                                Ultima descarga:{" "}
                                <span className="text-white">
                                  {lastDownload
                                    ? new Date(lastDownload.downloaded_at).toLocaleString("es-ES")
                                    : "Aun no descargado"}
                                </span>
                              </p>
                              <p>
                                Soporte: <span className="text-white">{supportSummary(supportTickets)}</span>
                              </p>
                              <p>
                                Disputas: <span className="text-white">{openDisputes} abiertas</span>
                              </p>
                            </div>

                            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                                Estado de acceso
                              </p>
                              <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
                                {access.ok
                                  ? lastDownload
                                    ? "Tu compra esta activa y puedes redescargar este producto cuando lo necesites."
                                    : "Tu compra esta activa y ya puedes descargar este producto."
                                  : access.message}
                              </p>
                              {license ? (
                                <p className="mt-3 text-xs text-[var(--text-soft)]">
                                  Licencia: <span className="font-mono text-white">{license.license_key}</span>
                                  {" · "}emitida el {new Date(license.issued_at).toLocaleDateString("es-ES")}
                                </p>
                              ) : (
                                <p className="mt-3 text-xs text-[var(--text-soft)]">
                                  Esta compra no tiene licencia asociada.
                                </p>
                              )}
                            </div>

                            <div className="mt-4">
                              <BuyerPostSaleClarityCard snapshot={transparencySnapshot} />
                            </div>
                          </div>

                          <div className="min-w-[240px] space-y-3">
                            {product?.id ? (
                              <DownloadButton
                                productId={product.id}
                                label={lastDownload ? "Descargar de nuevo" : "Descargar"}
                                variant={access.ok ? "primary" : "secondary"}
                              />
                            ) : null}

                            <div className="flex flex-wrap gap-2">
                              {product?.slug ? (
                                <Link href={`/products/${product.slug}`}>
                                  <Badge className="cursor-pointer border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white">
                                    Ver producto
                                  </Badge>
                                </Link>
                              ) : null}
                              {product?.id ? (
                                <Link href={`/support?product=${product.id}`}>
                                  <Badge className="cursor-pointer border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white">
                                    Abrir soporte
                                  </Badge>
                                </Link>
                              ) : null}
                              <Link href="/licenses">
                                <Badge className="cursor-pointer border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white">
                                  Ver licencias
                                </Badge>
                              </Link>
                              <Link href="/policies/reembolsos-y-reclamaciones">
                                <Badge className="cursor-pointer border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white">
                                  Policy de reembolsos
                                </Badge>
                              </Link>
                            </div>

                            {product?.id ? (
                              <div className="pt-1">
                                <DisputeForm
                                  orderId={order.id}
                                  productId={product.id}
                                  licenseId={license?.id || null}
                                  productTitle={product.title || "Producto"}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">Aun no tienes pedidos en tu cuenta.</p>
          </div>
        )}
      </section>
    </main>
  );
}
