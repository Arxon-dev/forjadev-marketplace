import Link from "next/link";
import { redirect } from "next/navigation";
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
  last_validated_at: string | null;
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

type DownloadAccessSnapshot = Awaited<ReturnType<typeof resolveDownloadAccess>>;

interface LibraryItem {
  product: ProductRow;
  latestOrderId: string;
  latestOrderAt: string;
  latestOrderStatus: string;
  latestItemPriceCents: number;
  orderCount: number;
  license: LicenseRow | null;
  access: DownloadAccessSnapshot;
  lastDownloadAt: string | null;
  downloadCount: number;
  supportTickets: SupportTicketRow[];
  openDisputes: number;
}

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
    return "Acceso disponible";
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

function licenseLabel(status: LicenseStatus) {
  return status === "active" ? "activa" : "revocada";
}

function pickPreferredLicense(licenses: LicenseRow[]) {
  if (licenses.length === 0) {
    return null;
  }

  return (
    licenses.find((license) => license.status === "active") ||
    [...licenses].sort((left, right) => {
      return new Date(right.issued_at).getTime() - new Date(left.issued_at).getTime();
    })[0]
  );
}

export default async function LicensesPage() {
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
      "id, created_at, status, total_cents, items:order_items(id, price_cents, product:products(id, title, slug, is_free, refund_policy), license:licenses(id, license_key, status, issued_at, last_validated_at))"
    )
    .eq("user_id", user.id)
    .in("status", ["completed", "refunded"])
    .order("created_at", { ascending: false });

  const orderRows = (orders || []) as OrderRow[];
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

  const downloadsByProductId = new Map<string, DownloadRow[]>();
  ((downloadsResult.data || []) as DownloadRow[]).forEach((download) => {
    downloadsByProductId.set(download.product_id, [
      ...(downloadsByProductId.get(download.product_id) || []),
      download,
    ]);
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

  const libraryMap = new Map<string, LibraryItem>();

  orderRows.forEach((order) => {
    (order.items || []).forEach((item) => {
      const product = Array.isArray(item.product) ? item.product[0] : item.product;
      const license = Array.isArray(item.license) ? item.license[0] : item.license;

      if (!product?.id) {
        return;
      }

      const existing = libraryMap.get(product.id);
      const downloads = downloadsByProductId.get(product.id) || [];
      const supportTickets = supportByProductId.get(product.id) || [];
      const openDisputes = (disputesByProductId.get(product.id) || []).filter(
        (dispute) => dispute.status !== "closed"
      ).length;
      const access =
        accessByProductId.get(product.id) ||
        ({
          ok: false,
          status: 409,
          message: "No se pudo resolver el acceso de descarga",
        } satisfies DownloadAccessSnapshot);

      if (!existing) {
        libraryMap.set(product.id, {
          product,
          latestOrderId: order.id,
          latestOrderAt: order.created_at,
          latestOrderStatus: order.status,
          latestItemPriceCents: item.price_cents,
          orderCount: 1,
          license: license || null,
          access,
          lastDownloadAt: downloads[0]?.downloaded_at || null,
          downloadCount: downloads.length,
          supportTickets,
          openDisputes,
        });
        return;
      }

      existing.orderCount += 1;

      if (new Date(order.created_at).getTime() > new Date(existing.latestOrderAt).getTime()) {
        existing.latestOrderAt = order.created_at;
        existing.latestOrderId = order.id;
        existing.latestOrderStatus = order.status;
        existing.latestItemPriceCents = item.price_cents;
      }

      existing.license = pickPreferredLicense(
        [existing.license, license].filter(Boolean) as LicenseRow[]
      );
    });
  });

  const libraryItems = Array.from(libraryMap.values()).sort((left, right) => {
    return new Date(right.latestOrderAt).getTime() - new Date(left.latestOrderAt).getTime();
  });

  const activeLicenseCount = libraryItems.filter((item) => item.license?.status === "active").length;
  const revokedLicenseCount = libraryItems.filter((item) => item.license?.status === "revoked").length;
  const availableAccessCount = libraryItems.filter((item) => item.access.ok).length;
  const blockedAccessCount = libraryItems.length - availableAccessCount;
  const redownloadableCount = libraryItems.filter((item) => item.downloadCount > 0).length;

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Library & Licenses</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Tu biblioteca y centro de acceso</h1>
        <p className="mt-3 max-w-3xl text-[var(--text-soft)]">
          Aqui ves que productos posees, que licencia esta activa o revocada, si la descarga esta
          habilitada y que hacer si algo se bloquea.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/orders" className="text-sm font-semibold text-white hover:underline">
            Ir a pedidos
          </Link>
          <Link href="/support?view=buyer" className="text-sm font-semibold text-white hover:underline">
            Centro de soporte
          </Link>
          <Link
            href="/policies/licencias-y-validacion"
            className="text-sm font-semibold text-white hover:underline"
          >
            Policy de licencias
          </Link>
          <Link href="/help" className="text-sm font-semibold text-white hover:underline">
            Help center
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Productos en biblioteca</p>
            <p className="mt-2 text-3xl font-bold text-white">{libraryItems.length}</p>
          </div>
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-200">Acceso disponible</p>
            <p className="mt-2 text-3xl font-bold text-white">{availableAccessCount}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Licencias activas</p>
            <p className="mt-2 text-3xl font-bold text-white">{activeLicenseCount}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Licencias revocadas</p>
            <p className="mt-2 text-3xl font-bold text-white">{revokedLicenseCount}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Redescargables</p>
            <p className="mt-2 text-3xl font-bold text-white">{redownloadableCount}</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">{blockedAccessCount} con bloqueo</p>
          </div>
        </div>

        {blockedAccessCount > 0 ? (
          <div className="mt-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
            <p className="text-sm font-semibold text-amber-300">
              Hay productos de tu biblioteca con acceso bloqueado o limitado.
            </p>
            <p className="mt-2 text-sm text-amber-200">
              Revisa el motivo en cada tarjeta. Si el bloqueo viene de licencia revocada o de un
              problema de release, desde aqui puedes continuar a pedido o soporte sin salir del flujo.
            </p>
          </div>
        ) : null}

        {libraryItems.length > 0 ? (
          <div className="mt-10 grid gap-5">
            {libraryItems.map((item) => {
              const isRevoked = item.license?.status === "revoked";
              const transparencySnapshot = buildBuyerPostSaleTransparencySnapshot({
                orderStatus: item.latestOrderStatus,
                accessOk: item.access.ok,
                accessMessage: item.access.ok ? null : item.access.message,
                licenseStatus: item.license?.status || null,
                hasDownload: item.downloadCount > 0,
                supportStatuses: item.supportTickets.map((ticket) => ticket.status),
                disputeStatuses: item.openDisputes > 0 ? ["open"] : [],
                productRefundPolicy: item.product.refund_policy || null,
              });

              return (
                <article
                  key={item.product.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-white">{item.product.title}</h2>
                        <Badge className={accessBadgeTone(item.access)}>{accessLabel(item.access)}</Badge>
                        {item.license ? (
                          <Badge
                            className={
                              isRevoked
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            }
                          >
                            Licencia {licenseLabel(item.license.status)}
                          </Badge>
                        ) : (
                          <Badge className="border-white/10 bg-white/5 text-[var(--text-soft)]">
                            Sin licencia emitida
                          </Badge>
                        )}
                        {item.latestOrderStatus === "refunded" ? (
                          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                            Pedido reembolsado
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-3 grid gap-3 text-sm text-[var(--text-soft)] md:grid-cols-2 xl:grid-cols-5">
                        <p>
                          Ultimo pedido:{" "}
                          <span className="text-white">
                            {new Date(item.latestOrderAt).toLocaleString("es-ES")}
                          </span>
                        </p>
                        <p>
                          Precio: <span className="text-white">{formatCurrency(item.latestItemPriceCents)}</span>
                        </p>
                        <p>
                          Descargas: <span className="text-white">{item.downloadCount}</span>
                        </p>
                        <p>
                          Soporte: <span className="text-white">{supportSummary(item.supportTickets)}</span>
                        </p>
                        <p>
                          Disputas: <span className="text-white">{item.openDisputes} abiertas</span>
                        </p>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                          Licencia y validacion
                        </p>

                        {item.license ? (
                          <p className="mt-3 text-xs text-[var(--text-soft)]">
                            Licencia: <span className="font-mono text-white">{item.license.license_key}</span>
                            {" · "}emitida el {new Date(item.license.issued_at).toLocaleDateString("es-ES")}
                            {" · "}ultima validacion{" "}
                            {item.license.last_validated_at
                              ? new Date(item.license.last_validated_at).toLocaleString("es-ES")
                              : "sin registrar"}
                          </p>
                        ) : (
                          <p className="mt-3 text-xs text-[var(--text-soft)]">
                            Este ownership no depende de una licencia individual emitida.
                          </p>
                        )}

                        {item.access.ok ? (
                          <p className="mt-3 text-xs text-emerald-200">
                            Release activa disponible: v{item.access.version.version}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        <BuyerPostSaleClarityCard snapshot={transparencySnapshot} />
                      </div>
                    </div>

                    <div className="min-w-[260px] space-y-3">
                      {item.access.ok ? (
                        <DownloadButton
                          productId={item.product.id}
                          label={item.downloadCount > 0 ? "Descargar de nuevo" : "Descargar"}
                          variant="primary"
                        />
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
                          <p className="text-sm text-[var(--text-soft)]">
                            La descarga no esta disponible ahora mismo. Revisa el pedido o abre soporte si
                            necesitas aclarar el bloqueo.
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Link href={`/orders?highlightOrder=${item.latestOrderId}`}>
                          <Badge className="cursor-pointer border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white">
                            Ver pedido
                          </Badge>
                        </Link>
                        <Link href={`/support?product=${item.product.id}`}>
                          <Badge className="cursor-pointer border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white">
                            Abrir soporte
                          </Badge>
                        </Link>
                        {item.product.slug ? (
                          <Link href={`/products/${item.product.slug}`}>
                            <Badge className="cursor-pointer border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white">
                              Ver producto
                            </Badge>
                          </Link>
                        ) : null}
                      </div>

                      <p className="text-xs text-[var(--text-soft)]">
                        {item.lastDownloadAt
                          ? `Ultima redescarga: ${new Date(item.lastDownloadAt).toLocaleString("es-ES")}`
                          : "Aun no has descargado este producto desde tu biblioteca."}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-lg font-semibold text-white">Tu biblioteca aun esta vacia.</p>
            <p className="mt-3 text-[var(--text-soft)]">
              Cuando completes una compra, este espacio mostrara tu ownership, tus licencias y el
              acceso real a descarga o redescarga.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link href="/products" className="text-sm font-semibold text-white hover:underline">
                Explorar productos
              </Link>
              <Link href="/help" className="text-sm font-semibold text-white hover:underline">
                Ir al help center
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
