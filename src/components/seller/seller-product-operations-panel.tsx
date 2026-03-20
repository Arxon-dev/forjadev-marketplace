"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ProductHealthFilter = "all" | "live" | "attention" | "draft";
type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";

interface SellerProductOperationsPanelProps {
  vendorId: string;
}

interface ProductRow {
  id: string;
  title: string;
  slug: string;
  moderation_status: string;
  rejection_reason: string | null;
  is_free: boolean;
  price_cents: number;
  featured: boolean;
  updated_at: string;
  created_at: string;
}

interface ProductVersionRow {
  id: string;
  product_id: string;
  version: string;
  release_status: string;
  created_at: string;
}

interface ProductFileRow {
  product_version_id: string;
}

interface SupportTicketRow {
  product_id: string;
  status: SupportTicketStatus;
}

interface CouponRow {
  product_id: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

interface CampaignRow {
  product_id: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  campaign_type: string;
}

interface ProductAnalyticsDailyRow {
  product_id: string;
  day: string;
  view_count: number;
  purchase_count: number;
  download_count: number;
  revenue_cents: number;
}

interface ProductOperationsRow {
  id: string;
  title: string;
  slug: string;
  moderationStatus: string;
  rejectionReason: string | null;
  priceLabel: string;
  featured: boolean;
  latestVersion: string | null;
  hasDownloadableFile: boolean;
  latestReleaseAt: string | null;
  hasPendingRelease: boolean;
  openTickets: number;
  waitingBuyerTickets: number;
  activeCoupons: number;
  activeCampaigns: number;
  views30d: number;
  purchases30d: number;
  downloads30d: number;
  revenue30dCents: number;
  updatedAt: string;
  needsAttention: boolean;
}

function formatCurrency(cents: number) {
  return cents === 0 ? "Gratis" : `EUR ${(cents / 100).toFixed(2)}`;
}

function isCurrentlyActive(
  item: Pick<CouponRow, "is_active" | "starts_at" | "ends_at"> | Pick<CampaignRow, "is_active" | "starts_at" | "ends_at">,
  now: Date
) {
  if (!item.is_active) {
    return false;
  }

  const startsAt = item.starts_at ? new Date(item.starts_at) : null;
  const endsAt = item.ends_at ? new Date(item.ends_at) : null;

  if (startsAt && startsAt > now) {
    return false;
  }

  if (endsAt && endsAt < now) {
    return false;
  }

  return true;
}

function moderationBadgeClass(status: string) {
  switch (status) {
    case "approved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "pending":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "rejected":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    case "hidden":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
    default:
      return "border-white/10 bg-white/5 text-[var(--text-soft)]";
  }
}

export function SellerProductOperationsPanel({
  vendorId,
}: SellerProductOperationsPanelProps) {
  const [rows, setRows] = useState<ProductOperationsRow[]>([]);
  const [filter, setFilter] = useState<ProductHealthFilter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();

      const { data: productsData } = await supabase
        .from("products")
        .select(
          "id, title, slug, moderation_status, rejection_reason, is_free, price_cents, featured, updated_at, created_at"
        )
        .eq("vendor_id", vendorId)
        .order("updated_at", { ascending: false });

      const products = (productsData || []) as ProductRow[];
      const productIds = products.map((product) => product.id);

      if (productIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const [
        versionsResult,
        supportTicketsResult,
        couponsResult,
        campaignsResult,
        analyticsResult,
      ] = await Promise.all([
        supabase
          .from("product_versions")
          .select("id, product_id, version, release_status, created_at")
          .in("product_id", productIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("support_tickets")
          .select("product_id, status")
          .eq("vendor_id", vendorId),
        supabase
          .from("coupons")
          .select("product_id, is_active, starts_at, ends_at")
          .eq("vendor_id", vendorId),
        supabase
          .from("campaigns")
          .select("product_id, is_active, starts_at, ends_at, campaign_type")
          .eq("vendor_id", vendorId)
          .not("product_id", "is", null),
        supabase
          .from("product_analytics_daily")
          .select("product_id, day, view_count, purchase_count, download_count, revenue_cents")
          .eq("vendor_id", vendorId)
          .gte("day", new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
      ]);

      const versions = (versionsResult.data || []) as ProductVersionRow[];
      const latestVersionByProductId = new Map<string, ProductVersionRow>();
      const hasPendingReleaseByProductId = new Map<string, boolean>();

      versions.forEach((version) => {
        if (version.release_status === "pending") {
          hasPendingReleaseByProductId.set(version.product_id, true);
        }

        const current = latestVersionByProductId.get(version.product_id);

        if (!current) {
          latestVersionByProductId.set(version.product_id, version);
          return;
        }

        if (current.release_status !== "active" && version.release_status === "active") {
          latestVersionByProductId.set(version.product_id, version);
        }
      });

      const versionIds = Array.from(
        new Set(Array.from(latestVersionByProductId.values()).map((version) => version.id))
      );

      const { data: filesData } =
        versionIds.length > 0
          ? await supabase
              .from("product_files")
              .select("product_version_id")
              .in("product_version_id", versionIds)
          : { data: [] as ProductFileRow[] };

      const fileVersionIds = new Set(
        ((filesData || []) as ProductFileRow[]).map((file) => file.product_version_id)
      );
      const supportTickets = (supportTicketsResult.data || []) as SupportTicketRow[];
      const coupons = (couponsResult.data || []) as CouponRow[];
      const campaigns = (campaignsResult.data || []) as CampaignRow[];
      const analytics = (analyticsResult.data || []) as ProductAnalyticsDailyRow[];
      const now = new Date();

      const supportByProductId = new Map<
        string,
        { open: number; waitingBuyer: number }
      >();
      supportTickets.forEach((ticket) => {
        const current = supportByProductId.get(ticket.product_id) || {
          open: 0,
          waitingBuyer: 0,
        };

        if (ticket.status !== "closed") {
          current.open += 1;
        }

        if (ticket.status === "waiting_buyer") {
          current.waitingBuyer += 1;
        }

        supportByProductId.set(ticket.product_id, current);
      });

      const activeCouponsByProductId = new Map<string, number>();
      coupons.forEach((coupon) => {
        if (!isCurrentlyActive(coupon, now)) {
          return;
        }

        activeCouponsByProductId.set(
          coupon.product_id,
          (activeCouponsByProductId.get(coupon.product_id) || 0) + 1
        );
      });

      const activeCampaignsByProductId = new Map<string, number>();
      campaigns.forEach((campaign) => {
        if (!campaign.product_id || !isCurrentlyActive(campaign, now)) {
          return;
        }

        activeCampaignsByProductId.set(
          campaign.product_id,
          (activeCampaignsByProductId.get(campaign.product_id) || 0) + 1
        );
      });

      const analyticsByProductId = new Map<
        string,
        { views: number; purchases: number; downloads: number; revenueCents: number }
      >();
      analytics.forEach((entry) => {
        const current = analyticsByProductId.get(entry.product_id) || {
          views: 0,
          purchases: 0,
          downloads: 0,
          revenueCents: 0,
        };

        current.views += entry.view_count;
        current.purchases += entry.purchase_count;
        current.downloads += entry.download_count;
        current.revenueCents += entry.revenue_cents;
        analyticsByProductId.set(entry.product_id, current);
      });

      const nextRows = products.map((product) => {
        const latestVersion = latestVersionByProductId.get(product.id) || null;
        const support = supportByProductId.get(product.id) || {
          open: 0,
          waitingBuyer: 0,
        };
        const analyticsSummary = analyticsByProductId.get(product.id) || {
          views: 0,
          purchases: 0,
          downloads: 0,
          revenueCents: 0,
        };
        const hasDownloadableFile = latestVersion
          ? fileVersionIds.has(latestVersion.id)
          : false;
        const activeCouponsCount = activeCouponsByProductId.get(product.id) || 0;
        const activeCampaignsCount = activeCampaignsByProductId.get(product.id) || 0;
        const hasPendingRelease = hasPendingReleaseByProductId.get(product.id) || false;
        const needsAttention =
          product.moderation_status !== "approved" ||
          Boolean(product.rejection_reason) ||
          hasPendingRelease ||
          support.open > 0 ||
          (latestVersion !== null && !hasDownloadableFile);

        return {
          id: product.id,
          title: product.title,
          slug: product.slug,
          moderationStatus: product.moderation_status,
          rejectionReason: product.rejection_reason,
          priceLabel: product.is_free ? "Gratis" : formatCurrency(product.price_cents),
          featured: product.featured,
          latestVersion: latestVersion?.version || null,
          hasDownloadableFile,
          latestReleaseAt: latestVersion?.created_at || null,
          hasPendingRelease,
          openTickets: support.open,
          waitingBuyerTickets: support.waitingBuyer,
          activeCoupons: activeCouponsCount,
          activeCampaigns: activeCampaignsCount,
          views30d: analyticsSummary.views,
          purchases30d: analyticsSummary.purchases,
          downloads30d: analyticsSummary.downloads,
          revenue30dCents: analyticsSummary.revenueCents,
          updatedAt: product.updated_at,
          needsAttention,
        } satisfies ProductOperationsRow;
      });

      setRows(nextRows);
      setLoading(false);
    };

    void fetchData();
  }, [vendorId]);

  const filteredRows = rows.filter((row) => {
    if (filter === "live") {
      return row.moderationStatus === "approved" && !row.needsAttention;
    }

    if (filter === "attention") {
      return row.needsAttention;
    }

    if (filter === "draft") {
      return row.moderationStatus === "draft" || row.moderationStatus === "pending";
    }

    return true;
  });

  const summary = {
    total: rows.length,
    live: rows.filter(
      (row) => row.moderationStatus === "approved" && !row.needsAttention
    ).length,
    attention: rows.filter((row) => row.needsAttention).length,
    revenue30dCents: rows.reduce((sum, row) => sum + row.revenue30dCents, 0),
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Operacion por producto</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Vista de control para releases, soporte, promos y traccion reciente de cada ficha.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === "all" ? "primary" : "secondary"}
            onClick={() => setFilter("all")}
          >
            Todos
          </Button>
          <Button
            variant={filter === "live" ? "primary" : "secondary"}
            onClick={() => setFilter("live")}
          >
            Operativos
          </Button>
          <Button
            variant={filter === "attention" ? "primary" : "secondary"}
            onClick={() => setFilter("attention")}
          >
            Requieren accion
          </Button>
          <Button
            variant={filter === "draft" ? "primary" : "secondary"}
            onClick={() => setFilter("draft")}
          >
            Draft / revision
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="text-sm text-[var(--text-soft)]">Productos</p>
          <p className="mt-2 text-2xl font-bold text-white">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="text-sm text-[var(--text-soft)]">Operativos</p>
          <p className="mt-2 text-2xl font-bold text-white">{summary.live}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="text-sm text-[var(--text-soft)]">Con accion pendiente</p>
          <p className="mt-2 text-2xl font-bold text-white">{summary.attention}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
          <p className="text-sm text-[var(--text-soft)]">Ingresos 30d</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatCurrency(summary.revenue30dCents)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center text-[var(--text-soft)]">
          Cargando operacion de productos...
        </div>
      ) : filteredRows.length > 0 ? (
        <div className="mt-6 space-y-4">
          {filteredRows.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-white/10 bg-black/10 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-semibold text-white">{row.title}</h3>
                    <Badge className={moderationBadgeClass(row.moderationStatus)}>
                      {row.moderationStatus}
                    </Badge>
                    {row.featured ? <Badge className="text-amber-300">Destacado</Badge> : null}
                    {row.hasPendingRelease ? (
                      <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                        Release pendiente
                      </Badge>
                    ) : null}
                    {row.needsAttention ? (
                      <Badge className="border-rose-500/30 bg-rose-500/10 text-rose-300">
                        Requiere accion
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge>{row.priceLabel}</Badge>
                    <Badge>
                      Version: {row.latestVersion || "Sin release"}
                    </Badge>
                    <Badge
                      className={
                        row.hasDownloadableFile
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      }
                    >
                      {row.hasDownloadableFile ? "ZIP listo" : "Archivo pendiente"}
                    </Badge>
                    <Badge>Tickets abiertos: {row.openTickets}</Badge>
                    <Badge>Promos activas: {row.activeCoupons + row.activeCampaigns}</Badge>
                  </div>

                  {row.rejectionReason ? (
                    <p className="mt-3 text-sm text-amber-300">
                      Revision: {row.rejectionReason}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  {row.slug ? (
                    <Link href={`/products/${row.slug}`}>
                      <Button variant="ghost">Ver</Button>
                    </Link>
                  ) : null}
                  <Link href={`/seller/products/${row.id}`}>
                    <Button variant="secondary">Gestionar</Button>
                  </Link>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    Release
                  </p>
                  <p className="mt-2 font-semibold text-white">
                    {row.latestVersion || "Aun sin version"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    {row.latestReleaseAt
                      ? new Date(row.latestReleaseAt).toLocaleDateString("es-ES")
                      : "Publica un ZIP para habilitar descargas"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    Soporte
                  </p>
                  <p className="mt-2 font-semibold text-white">{row.openTickets} abiertos</p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    {row.waitingBuyerTickets} esperando respuesta del buyer
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    Traccion 30d
                  </p>
                  <p className="mt-2 font-semibold text-white">
                    {row.views30d} vistas
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    {row.purchases30d} compras | {row.downloads30d} descargas
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    Monetizacion
                  </p>
                  <p className="mt-2 font-semibold text-white">
                    {formatCurrency(row.revenue30dCents)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    Ventana reciente de 30 dias
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                    Mantenimiento
                  </p>
                  <p className="mt-2 font-semibold text-white">
                    {row.activeCoupons + row.activeCampaigns} promos activas
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    Actualizado {new Date(row.updatedAt).toLocaleDateString("es-ES")}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center">
          <p className="text-[var(--text-soft)]">
            No hay productos que coincidan con este filtro.
          </p>
        </div>
      )}
    </div>
  );
}
