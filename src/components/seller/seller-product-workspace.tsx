"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";

interface SellerProductWorkspaceProps {
  productId: string;
}

type ReleaseStatus = "pending" | "active" | "historical" | "retired";

interface ProductRow {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  moderation_status: string;
  rejection_reason: string | null;
  is_free: boolean;
  price_cents: number;
  featured: boolean;
}

interface ProductVersionRow {
  id: string;
  version: string;
  changelog: string | null;
  release_status: ReleaseStatus;
  activated_at: string | null;
  retired_at: string | null;
  retired_reason: string | null;
  created_at: string;
}

interface ProductFileRow {
  id: string;
  product_version_id: string;
  file_name: string;
  file_size_bytes: number | null;
}

interface SupportTicketRow {
  status: "open" | "waiting_seller" | "waiting_buyer" | "closed";
}

interface CouponRow {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

interface CampaignRow {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

interface ProductAnalyticsDailyRow {
  view_count: number;
  purchase_count: number;
  download_count: number;
  revenue_cents: number;
}

const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = {
  pending: "Pendiente",
  active: "Activa",
  historical: "Historica",
  retired: "Retirada",
};

function formatCurrency(cents: number) {
  return cents === 0 ? "Gratis" : `EUR ${(cents / 100).toFixed(2)}`;
}

function formatBytes(value: number | null) {
  if (!value || value <= 0) {
    return "Tamano no disponible";
  }

  const units = ["B", "KB", "MB", "GB"];
  let current = value;
  let index = 0;

  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }

  return `${current.toFixed(current >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function isCurrentlyActive(item: {
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}) {
  if (!item.is_active) {
    return false;
  }

  const now = Date.now();
  const startsAt = item.starts_at ? new Date(item.starts_at).getTime() : null;
  const endsAt = item.ends_at ? new Date(item.ends_at).getTime() : null;

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

function releaseBadgeClass(status: ReleaseStatus) {
  switch (status) {
    case "active":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "pending":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "historical":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "retired":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    default:
      return "border-white/10 bg-white/5 text-[var(--text-soft)]";
  }
}

function releaseSortOrder(status: ReleaseStatus) {
  switch (status) {
    case "pending":
      return 0;
    case "active":
      return 1;
    case "historical":
      return 2;
    case "retired":
      return 3;
    default:
      return 4;
  }
}

export function SellerProductWorkspace({ productId }: SellerProductWorkspaceProps) {
  const [product, setProduct] = useState<ProductRow | null>(null);
  const [versions, setVersions] = useState<ProductVersionRow[]>([]);
  const [filesByVersionId, setFilesByVersionId] = useState<Map<string, ProductFileRow[]>>(new Map());
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [activeCoupons, setActiveCoupons] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [analytics, setAnalytics] = useState({
    views: 0,
    purchases: 0,
    downloads: 0,
    revenueCents: 0,
  });
  const [releaseVersion, setReleaseVersion] = useState("");
  const [releaseChangelog, setReleaseChangelog] = useState("");
  const [releaseFile, setReleaseFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingRelease, setSubmittingRelease] = useState(false);
  const [actingVersionId, setActingVersionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: productData } = await supabase
      .from("products")
      .select(
        "id, title, slug, short_description, moderation_status, rejection_reason, is_free, price_cents, featured"
      )
      .eq("id", productId)
      .single();

    if (!productData) {
      setProduct(null);
      setVersions([]);
      setFilesByVersionId(new Map());
      setTickets([]);
      setActiveCampaigns(0);
      setActiveCoupons(0);
      setAnalytics({ views: 0, purchases: 0, downloads: 0, revenueCents: 0 });
      setLoading(false);
      return;
    }

    setProduct(productData as ProductRow);

    const [versionsResult, ticketsResult, couponsResult, campaignsResult, analyticsResult] =
      await Promise.all([
        supabase
          .from("product_versions")
          .select(
            "id, version, changelog, release_status, activated_at, retired_at, retired_reason, created_at"
          )
          .eq("product_id", productId)
          .order("created_at", { ascending: false }),
        supabase.from("support_tickets").select("status").eq("product_id", productId).limit(20),
        supabase.from("coupons").select("is_active, starts_at, ends_at").eq("product_id", productId),
        supabase.from("campaigns").select("is_active, starts_at, ends_at").eq("product_id", productId),
        supabase
          .from("product_analytics_daily")
          .select("view_count, purchase_count, download_count, revenue_cents")
          .eq("product_id", productId)
          .gte("day", new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
      ]);

    const versionRows = ((versionsResult.data || []) as ProductVersionRow[]).sort((left, right) => {
      const byStatus = releaseSortOrder(left.release_status) - releaseSortOrder(right.release_status);
      if (byStatus !== 0) {
        return byStatus;
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
    setVersions(versionRows);

    const versionIds = versionRows.map((version) => version.id);
    const { data: fileRows } =
      versionIds.length > 0
        ? await supabase
            .from("product_files")
            .select("id, product_version_id, file_name, file_size_bytes")
            .in("product_version_id", versionIds)
            .order("created_at", { ascending: false })
        : { data: [] };

    const nextFilesByVersionId = new Map<string, ProductFileRow[]>();
    ((fileRows || []) as ProductFileRow[]).forEach((file) => {
      nextFilesByVersionId.set(file.product_version_id, [
        ...(nextFilesByVersionId.get(file.product_version_id) || []),
        file,
      ]);
    });
    setFilesByVersionId(nextFilesByVersionId);

    setTickets((ticketsResult.data || []) as SupportTicketRow[]);
    setActiveCoupons(
      ((couponsResult.data || []) as CouponRow[]).filter((item) => isCurrentlyActive(item)).length
    );
    setActiveCampaigns(
      ((campaignsResult.data || []) as CampaignRow[]).filter((item) => isCurrentlyActive(item)).length
    );

    const analyticsSummary = ((analyticsResult.data || []) as ProductAnalyticsDailyRow[]).reduce(
      (accumulator, entry) => ({
        views: accumulator.views + entry.view_count,
        purchases: accumulator.purchases + entry.purchase_count,
        downloads: accumulator.downloads + entry.download_count,
        revenueCents: accumulator.revenueCents + entry.revenue_cents,
      }),
      { views: 0, purchases: 0, downloads: 0, revenueCents: 0 }
    );
    setAnalytics(analyticsSummary);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const activeRelease = useMemo(
    () => versions.find((version) => version.release_status === "active") || null,
    [versions]
  );
  const pendingRelease = useMemo(
    () => versions.find((version) => version.release_status === "pending") || null,
    [versions]
  );
  const activeReleaseFiles = activeRelease ? filesByVersionId.get(activeRelease.id) || [] : [];
  const openTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status !== "closed").length,
    [tickets]
  );
  const waitingSellerTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === "waiting_seller").length,
    [tickets]
  );
  const needsAttention =
    !product ||
    Boolean(product.rejection_reason) ||
    waitingSellerTickets > 0 ||
    !activeRelease ||
    activeReleaseFiles.length === 0;

  const handlePublishRelease = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!releaseVersion.trim()) {
      setError("Debes indicar la version de la release.");
      return;
    }

    if (!releaseFile) {
      setError("Debes seleccionar un ZIP para la release.");
      return;
    }

    setSubmittingRelease(true);

    try {
      const formData = new FormData();
      formData.set("version", releaseVersion.trim());
      formData.set("changelog", releaseChangelog.trim());
      formData.set("file", releaseFile);

      const response = await fetch(`/api/seller/products/${productId}/releases`, {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo registrar la release.");
      }

      setReleaseFile(null);
      setReleaseVersion("");
      setReleaseChangelog("");
      setSuccessMessage(
        "La release quedo pendiente de revision. La release activa actual sigue siendo la descarga del buyer hasta nueva aprobacion."
      );
      await loadWorkspace();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la release.");
    } finally {
      setSubmittingRelease(false);
    }
  };

  const handleReleaseAction = async (versionId: string, action: "activate" | "retire") => {
    setError("");
    setSuccessMessage("");
    setActingVersionId(versionId);

    try {
      const response = await fetch(
        `/api/seller/products/${productId}/releases/${versionId}/status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            reason: action === "retire" ? "seller_retired" : undefined,
          }),
        }
      );

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo actualizar la release.");
      }

      setSuccessMessage(
        action === "activate"
          ? "La release historica ahora es la vigente del producto."
          : "La release se retiro correctamente del ciclo operativo."
      );
      await loadWorkspace();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la release.");
    } finally {
      setActingVersionId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-16 text-center text-[var(--text-soft)]">
        Cargando centro operativo del producto...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 px-6 py-16 text-center text-rose-200">
        Este producto no esta disponible o no pertenece a tu tienda.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_rgba(255,255,255,0.03)_40%,_rgba(0,0,0,0.2)_100%)] p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={moderationBadgeClass(product.moderation_status)}>
                {product.moderation_status}
              </Badge>
              {product.featured ? <Badge className="text-amber-300">Destacado</Badge> : null}
              <Badge
                className={
                  needsAttention
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                }
              >
                {needsAttention ? "Requiere accion" : "Flujo sano"}
              </Badge>
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">{product.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
              {product.short_description ||
                "Centro de mando para releases, trazabilidad y mantenimiento vivo del producto."}
            </p>
            {product.rejection_reason ? (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <span className="font-semibold">Revision actual:</span> {product.rejection_reason}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/seller">
              <Button variant="ghost">Volver al panel</Button>
            </Link>
            <Link href={`/products/${product.slug}`}>
              <Button variant="ghost">Ver ficha publica</Button>
            </Link>
            <Link href={`/seller/products/${product.id}/edit`}>
              <Button variant="secondary">Editar ficha</Button>
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Release vigente</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {activeRelease ? `v${activeRelease.version}` : "Sin activa"}
            </p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              {activeRelease
                ? `Buyer descarga esta release`
                : "No existe una release activa para descargas"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Revision pendiente</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {pendingRelease ? `v${pendingRelease.version}` : "Ninguna"}
            </p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              {pendingRelease ? "Aun no afecta al buyer" : "Sin release esperando aprobacion"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Archivo activo</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {activeReleaseFiles[0]?.file_name || "Pendiente"}
            </p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              {activeReleaseFiles[0]
                ? formatBytes(activeReleaseFiles[0].file_size_bytes)
                : "La release activa necesita ZIP"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Soporte abierto</p>
            <p className="mt-2 text-lg font-semibold text-white">{openTickets}</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              {waitingSellerTickets} esperando seller
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Ingresos 30d</p>
            <p className="mt-2 text-lg font-semibold text-white">{formatCurrency(analytics.revenueCents)}</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              {analytics.purchases} compras | {analytics.downloads} descargas
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handlePublishRelease} className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Nueva release pendiente</h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                La nueva subida entra en revision. La release activa actual sigue siendo la vigente hasta aprobar la pendiente.
              </p>
            </div>
            <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">
              No sustituye al buyer todavia
            </Badge>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {successMessage}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-white">Version</label>
              <input
                type="text"
                value={releaseVersion}
                onChange={(event) => setReleaseVersion(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                placeholder="1.2.0"
                disabled={submittingRelease || Boolean(pendingRelease)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">ZIP de la release</label>
              <div className="mt-2">
                <FileUpload
                  onFileSelected={async (file) => {
                    setReleaseFile(file);
                  }}
                  accept=".zip,application/zip,application/x-zip-compressed"
                  maxSize={100 * 1024 * 1024}
                  label={releaseFile ? "Cambiar ZIP" : "Seleccionar ZIP"}
                  isLoading={submittingRelease || Boolean(pendingRelease)}
                  autoClearOnSuccess={false}
                  successMessage="ZIP listo para enviar a revision"
                />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-sm font-medium text-white">Changelog</label>
            <textarea
              value={releaseChangelog}
              onChange={(event) => setReleaseChangelog(event.target.value)}
              rows={6}
              disabled={submittingRelease || Boolean(pendingRelease)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
              placeholder="Que corrige, mejora o anade esta release"
            />
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/10 px-4 py-4 text-sm text-[var(--text-soft)]">
            <p>Reglas:</p>
            <p className="mt-1">1) solo puede existir una release pendiente, 2) no se reemplaza un ZIP en sitio, 3) para corregir una pendiente debes retirarla y subir otra.</p>
          </div>

          <div className="mt-5 flex justify-end">
            <Button type="submit" disabled={submittingRelease || Boolean(pendingRelease)}>
              {submittingRelease ? "Enviando..." : pendingRelease ? "Ya hay una pendiente" : "Enviar a revision"}
            </Button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Reglas del lifecycle</h2>
            <div className="mt-5 space-y-3 text-sm text-[var(--text-soft)]">
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <p className="font-semibold text-white">Activa</p>
                <p className="mt-1">Es la release vigente para buyer y descargas.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <p className="font-semibold text-white">Pendiente</p>
                <p className="mt-1">Esta en revision. No reemplaza la descarga activa hasta aprobarse.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <p className="font-semibold text-white">Historica</p>
                <p className="mt-1">Fue activa antes y puede reactivarse como rollback seguro.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <p className="font-semibold text-white">Retirada</p>
                <p className="mt-1">Queda fuera del ciclo operativo y no puede volver a activarse.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Acciones conectadas</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/seller/products/${product.id}/edit`}>
                <Button variant="secondary">Editar metadata</Button>
              </Link>
              <Link href={`/seller/products/${product.id}/support`}>
                <Button variant="secondary">Soporte del producto</Button>
              </Link>
              <Link href={`/seller/products/${product.id}/promotions`}>
                <Button variant="secondary">Promociones y cupones</Button>
              </Link>
              <Link href="/support?view=seller">
                <Button variant="ghost">Centro de soporte</Button>
              </Link>
              <Link href="/seller">
                <Button variant="ghost">Panel seller</Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-[var(--text-soft)]">
              Gestiona releases, revision y soporte desde el mismo centro operativo del producto. Ahora puedes entrar a la cola privada de tickets del producto sin perder el contexto de su release viva.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Contexto comercial</h2>
            <div className="mt-5 grid gap-3 text-sm text-[var(--text-soft)] sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <p>Vistas 30d</p>
                <p className="mt-1 font-semibold text-white">{analytics.views}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                <p>Promos activas</p>
                <p className="mt-1 font-semibold text-white">{activeCoupons + activeCampaigns}</p>
              </div>
            </div>
            <div className="mt-4">
              <Link href={`/seller/products/${product.id}/promotions`}>
                <Button variant="secondary">Abrir capa comercial</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Timeline de releases</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Trazabilidad real de que esta viva, que quedo historico y que fue retirado.
            </p>
          </div>
          <Badge>{versions.length} releases</Badge>
        </div>

        {versions.length > 0 ? (
          <div className="mt-6 space-y-4">
            {versions.map((version) => {
              const versionFiles = filesByVersionId.get(version.id) || [];
              const canActivate = version.release_status === "historical";
              const canRetire =
                version.release_status === "historical" || version.release_status === "pending";

              return (
                <article key={version.id} className="rounded-2xl border border-white/10 bg-black/10 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">v{version.version}</h3>
                        <Badge className={releaseBadgeClass(version.release_status)}>
                          {RELEASE_STATUS_LABELS[version.release_status]}
                        </Badge>
                        <Badge
                          className={
                            versionFiles.length > 0
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          }
                        >
                          {versionFiles.length > 0 ? "ZIP listo" : "Sin activo"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-[var(--text-soft)]">
                        Creada el {new Date(version.created_at).toLocaleDateString("es-ES")}
                        {version.activated_at ? ` · activa desde ${new Date(version.activated_at).toLocaleDateString("es-ES")}` : ""}
                      </p>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--text-soft)]">
                        {version.changelog?.trim() || "Sin changelog registrado en esta release."}
                      </p>
                      {version.retired_reason ? (
                        <p className="mt-3 text-sm text-rose-200">
                          Motivo de retirada: {version.retired_reason}
                        </p>
                      ) : null}
                    </div>

                    <div className="min-w-[240px] space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Assets</p>
                        {versionFiles.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {versionFiles.map((file) => (
                              <div key={file.id} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                                <p className="truncate text-sm font-medium text-white">{file.file_name}</p>
                                <p className="mt-1 text-xs text-[var(--text-soft)]">
                                  {formatBytes(file.file_size_bytes)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-amber-200">
                            Esta release no tiene ZIP utilizable.
                          </p>
                        )}
                      </div>

                      {(canActivate || canRetire) ? (
                        <div className="flex flex-wrap gap-2">
                          {canActivate ? (
                            <Button
                              variant="secondary"
                              disabled={actingVersionId === version.id}
                              onClick={() => void handleReleaseAction(version.id, "activate")}
                            >
                              {actingVersionId === version.id ? "Activando..." : "Activar"}
                            </Button>
                          ) : null}
                          {canRetire ? (
                            <Button
                              variant="ghost"
                              disabled={actingVersionId === version.id}
                              onClick={() => void handleReleaseAction(version.id, "retire")}
                            >
                              {actingVersionId === version.id ? "Retirando..." : "Retirar"}
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--text-soft)]">
                          {version.release_status === "active"
                            ? "La release activa no se retira directamente. Primero activa otra o envia una nueva."
                            : "Sin acciones disponibles para esta release."}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">
              Todavia no hay releases registradas para este producto.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
