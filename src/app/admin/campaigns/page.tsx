import Link from "next/link";
import { CampaignActions } from "@/components/admin/campaign-actions";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type CampaignType = "flash_deal" | "launch_discount" | "featured_placement";

interface CampaignRow {
  id: string;
  vendor_id: string;
  product_id: string | null;
  bundle_id: string | null;
  title: string;
  campaign_type: CampaignType;
  discount_type: "percent" | "fixed" | null;
  discount_value: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface VendorRow {
  id: string;
  store_name: string;
}

interface ProductRow {
  id: string;
  title: string;
  slug: string;
}

interface BundleRow {
  id: string;
  title: string;
  slug: string;
}

interface AdminCampaignsPageProps {
  searchParams?: Promise<{
    status?: string;
    type?: string;
  }>;
}

function isLiveCampaign(campaign: CampaignRow, nowIso: string) {
  return (
    campaign.is_active &&
    (!campaign.starts_at || campaign.starts_at <= nowIso) &&
    (!campaign.ends_at || campaign.ends_at >= nowIso)
  );
}

function isScheduledCampaign(campaign: CampaignRow, nowIso: string) {
  return campaign.is_active && Boolean(campaign.starts_at && campaign.starts_at > nowIso);
}

function isEndedCampaign(campaign: CampaignRow, nowIso: string) {
  return Boolean(campaign.ends_at && campaign.ends_at < nowIso);
}

function isExpiringSoon(campaign: CampaignRow, now: Date) {
  if (!campaign.ends_at || !campaign.is_active) {
    return false;
  }

  const diffMs = new Date(campaign.ends_at).getTime() - now.getTime();
  return diffMs >= 0 && diffMs <= 72 * 60 * 60 * 1000;
}

function formatDiscount(campaign: CampaignRow) {
  if (campaign.campaign_type === "featured_placement") {
    return "Placement premium";
  }

  if (!campaign.discount_type || !campaign.discount_value) {
    return "Sin descuento";
  }

  if (campaign.discount_type === "fixed") {
    return `EUR ${(campaign.discount_value / 100).toFixed(2)}`;
  }

  return `${campaign.discount_value}%`;
}

export default async function AdminCampaignsPage({
  searchParams,
}: AdminCampaignsPageProps) {
  await requireAdminContext();
  const adminSupabase = createAdminClient();
  const params = (await searchParams) || {};
  const selectedStatus = params.status || "all";
  const selectedType = params.type || "all";
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: campaigns } = (await adminSupabase
    .from("campaigns")
    .select(
      "id, vendor_id, product_id, bundle_id, title, campaign_type, discount_type, discount_value, starts_at, ends_at, is_active, created_at, updated_at"
    )
    .order("created_at", { ascending: false })) as { data: CampaignRow[] | null };

  const allCampaigns = campaigns || [];
  const vendorIds = Array.from(new Set(allCampaigns.map((campaign) => campaign.vendor_id)));
  const productIds = Array.from(
    new Set(allCampaigns.map((campaign) => campaign.product_id).filter(Boolean))
  ) as string[];
  const bundleIds = Array.from(
    new Set(allCampaigns.map((campaign) => campaign.bundle_id).filter(Boolean))
  ) as string[];

  const [{ data: vendors }, { data: products }, { data: bundles }] = await Promise.all([
    vendorIds.length
      ? adminSupabase.from("vendors").select("id, store_name").in("id", vendorIds)
      : Promise.resolve({ data: [] as VendorRow[] }),
    productIds.length
      ? adminSupabase.from("products").select("id, title, slug").in("id", productIds)
      : Promise.resolve({ data: [] as ProductRow[] }),
    bundleIds.length
      ? adminSupabase.from("bundles").select("id, title, slug").in("id", bundleIds)
      : Promise.resolve({ data: [] as BundleRow[] }),
  ]);

  const vendorById = new Map(((vendors || []) as VendorRow[]).map((item) => [item.id, item]));
  const productById = new Map(((products || []) as ProductRow[]).map((item) => [item.id, item]));
  const bundleById = new Map(((bundles || []) as BundleRow[]).map((item) => [item.id, item]));

  const filteredCampaigns = allCampaigns.filter((campaign) => {
    if (selectedType !== "all" && campaign.campaign_type !== selectedType) {
      return false;
    }

    if (selectedStatus === "live") {
      return isLiveCampaign(campaign, nowIso);
    }

    if (selectedStatus === "scheduled") {
      return isScheduledCampaign(campaign, nowIso);
    }

    if (selectedStatus === "ended") {
      return isEndedCampaign(campaign, nowIso);
    }

    if (selectedStatus === "inactive") {
      return !campaign.is_active;
    }

    return true;
  });

  const counts = {
    total: allCampaigns.length,
    live: allCampaigns.filter((campaign) => isLiveCampaign(campaign, nowIso)).length,
    placements: allCampaigns.filter(
      (campaign) =>
        campaign.campaign_type === "featured_placement" && isLiveCampaign(campaign, nowIso)
    ).length,
    expiringSoon: allCampaigns.filter((campaign) => isExpiringSoon(campaign, now)).length,
    inactive: allCampaigns.filter((campaign) => !campaign.is_active).length,
    scheduled: allCampaigns.filter((campaign) => isScheduledCampaign(campaign, nowIso)).length,
  };

  const sellerOps = Array.from(new Set(allCampaigns.map((campaign) => campaign.vendor_id)))
    .map((vendorId) => {
      const vendorCampaigns = allCampaigns.filter((campaign) => campaign.vendor_id === vendorId);
      const vendor = vendorById.get(vendorId);

      return {
        vendorId,
        storeName: vendor?.store_name || "Tienda",
        live: vendorCampaigns.filter((campaign) => isLiveCampaign(campaign, nowIso)).length,
        placements: vendorCampaigns.filter(
          (campaign) =>
            campaign.campaign_type === "featured_placement" && isLiveCampaign(campaign, nowIso)
        ).length,
        expiringSoon: vendorCampaigns.filter((campaign) => isExpiringSoon(campaign, now)).length,
      };
    })
    .sort(
      (a, b) =>
        b.live - a.live ||
        b.placements - a.placements ||
        b.expiringSoon - a.expiringSoon ||
        a.storeName.localeCompare(b.storeName)
    )
    .slice(0, 6);

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Admin</p>
            <h1 className="mt-3 text-4xl font-bold text-white">Campaign Ops</h1>
            <p className="mt-3 max-w-3xl text-[var(--text-soft)]">
              Supervisa promociones, launch discounts y placements premium para mantener el
              discovery comercial bajo control operativo.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="secondary">Volver a admin</Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Campanas</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-200">Activas</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.live}</p>
          </div>
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-5">
            <p className="text-sm text-sky-200">Placements</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.placements}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-200">Expiran pronto</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.expiringSoon}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Programadas</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.scheduled}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5">
            <p className="text-sm text-rose-200">Inactivas</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.inactive}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/admin/campaigns">
            <Button variant={selectedStatus === "all" ? "primary" : "secondary"}>Todas</Button>
          </Link>
          <Link href="/admin/campaigns?status=live">
            <Button variant={selectedStatus === "live" ? "primary" : "secondary"}>Activas</Button>
          </Link>
          <Link href="/admin/campaigns?status=scheduled">
            <Button variant={selectedStatus === "scheduled" ? "primary" : "secondary"}>Programadas</Button>
          </Link>
          <Link href="/admin/campaigns?status=ended">
            <Button variant={selectedStatus === "ended" ? "primary" : "secondary"}>Expiradas</Button>
          </Link>
          <Link href="/admin/campaigns?status=inactive">
            <Button variant={selectedStatus === "inactive" ? "primary" : "secondary"}>Inactivas</Button>
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/admin/campaigns${selectedStatus !== "all" ? `?status=${selectedStatus}` : ""}`}>
            <Button variant={selectedType === "all" ? "primary" : "secondary"}>Todos los tipos</Button>
          </Link>
          {(["flash_deal", "launch_discount", "featured_placement"] as CampaignType[]).map((type) => (
            <Link
              key={type}
              href={`/admin/campaigns?${selectedStatus !== "all" ? `status=${selectedStatus}&` : ""}type=${type}`}
            >
              <Button variant={selectedType === type ? "primary" : "secondary"}>
                {type}
              </Button>
            </Link>
          ))}
        </div>

        <div className="mt-10 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Control operativo</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Gestiona campañas activas, programadas o fuera de ventana sin depender del panel seller.
            </p>

            {filteredCampaigns.length > 0 ? (
              <div className="mt-5 space-y-4">
                {filteredCampaigns.map((campaign) => {
                  const vendor = vendorById.get(campaign.vendor_id);
                  const product = campaign.product_id ? productById.get(campaign.product_id) : null;
                  const bundle = campaign.bundle_id ? bundleById.get(campaign.bundle_id) : null;
                  const statusLabel = isEndedCampaign(campaign, nowIso)
                    ? "expirada"
                    : isScheduledCampaign(campaign, nowIso)
                      ? "programada"
                      : isLiveCampaign(campaign, nowIso)
                        ? "activa"
                        : "inactiva";

                  return (
                    <article
                      key={campaign.id}
                      className="rounded-2xl border border-white/10 bg-black/10 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-3">
                          <div>
                            <h3 className="text-lg font-semibold text-white">{campaign.title}</h3>
                            <p className="mt-2 text-sm text-[var(--text-soft)]">
                              {vendor?.store_name || "Tienda"} | {campaign.campaign_type} | {formatDiscount(campaign)}
                            </p>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                                Objetivo
                              </p>
                              <p className="mt-1 text-white">
                                {campaign.product_id ? product?.title || "Producto" : bundle?.title || "Bundle"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                                Ventana
                              </p>
                              <p className="mt-1 text-white">
                                {campaign.starts_at
                                  ? new Date(campaign.starts_at).toLocaleDateString("es-ES")
                                  : "Ahora"}{" "}
                                -{" "}
                                {campaign.ends_at
                                  ? new Date(campaign.ends_at).toLocaleDateString("es-ES")
                                  : "Sin fin"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                                Estado
                              </p>
                              <p className="mt-1 text-white capitalize">{statusLabel}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3">
                            {product?.slug ? (
                              <Link href={`/products/${product.slug}`}>
                                <Button variant="secondary">Ver producto</Button>
                              </Link>
                            ) : null}
                            {bundle?.slug ? (
                              <Link href={`/bundles/${bundle.slug}`}>
                                <Button variant="secondary">Ver bundle</Button>
                              </Link>
                            ) : null}
                          </div>
                        </div>

                        <CampaignActions campaignId={campaign.id} isActive={campaign.is_active} />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center">
                <p className="text-[var(--text-soft)]">No hay campanas para este filtro.</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Top sellers con promo activa</h2>
              <div className="mt-4 space-y-3">
                {sellerOps.length > 0 ? (
                  sellerOps.map((seller) => (
                    <div
                      key={seller.vendorId}
                      className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">{seller.storeName}</p>
                        <p className="text-xs text-[var(--text-soft)]">{seller.live} activas</p>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--text-soft)]">
                        <span>Placements: {seller.placements}</span>
                        <span>Expiran pronto: {seller.expiringSoon}</span>
                        <span>Live: {seller.live}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[var(--text-soft)]">Sin sellers con promo activa.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Criterio operativo</h2>
              <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
                <p>`Activa`: visible ahora mismo dentro de su ventana temporal.</p>
                <p>`Programada`: activada pero con inicio futuro.</p>
                <p>`Expira pronto`: termina en las proximas 72 horas.</p>
                <p>Los admins pueden pausar o reactivar sin cambiar la propiedad seller de la campana.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
