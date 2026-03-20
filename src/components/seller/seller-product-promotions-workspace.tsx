"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type CampaignType = "flash_deal" | "launch_discount" | "featured_placement";
type DiscountType = "percent" | "fixed";

export interface SellerProductCampaignItem {
  id: string;
  title: string;
  campaign_type: CampaignType;
  discount_type: DiscountType | null;
  discount_value: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SellerProductCouponItem {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  is_active: boolean;
  created_at: string;
}

interface SellerProductPromotionMetrics {
  views: number;
  purchases: number;
  revenueCents: number;
}

interface SellerProductPromotionsWorkspaceProps {
  productId: string;
  productTitle: string;
  productSlug: string;
  priceCents: number;
  activeReleaseVersion: string | null;
  campaigns: SellerProductCampaignItem[];
  coupons: SellerProductCouponItem[];
  metrics: SellerProductPromotionMetrics;
}

type CommercialStatus = "vigente" | "programada" | "caducada" | "inactiva" | "agotado";

interface CampaignFormState {
  id: string | null;
  title: string;
  campaignType: CampaignType;
  discountType: DiscountType;
  discountValue: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

interface CouponFormState {
  id: string | null;
  code: string;
  discountType: DiscountType;
  discountValue: string;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  isActive: boolean;
}

const EMPTY_CAMPAIGN_FORM: CampaignFormState = {
  id: null,
  title: "",
  campaignType: "flash_deal",
  discountType: "percent",
  discountValue: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

const EMPTY_COUPON_FORM: CouponFormState = {
  id: null,
  code: "",
  discountType: "percent",
  discountValue: "",
  startsAt: "",
  endsAt: "",
  maxRedemptions: "",
  isActive: true,
};

function formatCurrency(cents: number) {
  return cents <= 0 ? "Gratis" : `EUR ${(cents / 100).toFixed(2)}`;
}

function formatDiscount(discountType: DiscountType | null, discountValue: number | null) {
  if (!discountType || discountValue === null) {
    return "Sin descuento directo";
  }

  return discountType === "fixed"
    ? `EUR ${(discountValue / 100).toFixed(2)}`
    : `${discountValue}%`;
}

function toLocalDateTimeValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const normalized = new Date(date.getTime() - offset * 60_000);
  return normalized.toISOString().slice(0, 16);
}

function fromDateInput(value: string) {
  return value.trim() ? new Date(value).toISOString() : null;
}

function parseDiscountValue(rawValue: string) {
  const parsed = Number.parseFloat(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCommercialStatus(params: {
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  redemptionCount?: number;
  maxRedemptions?: number | null;
}) {
  if (!params.isActive) {
    return "inactiva" as const;
  }

  if (
    params.maxRedemptions !== null &&
    params.maxRedemptions !== undefined &&
    params.redemptionCount !== undefined &&
    params.redemptionCount >= params.maxRedemptions
  ) {
    return "agotado" as const;
  }

  const now = Date.now();
  const startsAt = params.startsAt ? new Date(params.startsAt).getTime() : null;
  const endsAt = params.endsAt ? new Date(params.endsAt).getTime() : null;

  if (startsAt && startsAt > now) {
    return "programada" as const;
  }

  if (endsAt && endsAt < now) {
    return "caducada" as const;
  }

  return "vigente" as const;
}

function statusBadgeClass(status: CommercialStatus) {
  switch (status) {
    case "vigente":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "programada":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "caducada":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "agotado":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    default:
      return "border-white/10 bg-white/5 text-[var(--text-soft)]";
  }
}

function formatWindow(startsAt: string | null, endsAt: string | null) {
  const startLabel = startsAt ? new Date(startsAt).toLocaleDateString("es-ES") : "Ahora";
  const endLabel = endsAt ? new Date(endsAt).toLocaleDateString("es-ES") : "Sin fin";
  return `${startLabel} - ${endLabel}`;
}

export function SellerProductPromotionsWorkspace({
  productId,
  productTitle,
  productSlug,
  priceCents,
  activeReleaseVersion,
  campaigns,
  coupons,
  metrics,
}: SellerProductPromotionsWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(EMPTY_CAMPAIGN_FORM);
  const [couponForm, setCouponForm] = useState<CouponFormState>(EMPTY_COUPON_FORM);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [actingKey, setActingKey] = useState<string | null>(null);

  const activeCommercialItems = useMemo(() => {
    const activeCampaigns = campaigns.filter(
      (campaign) =>
        getCommercialStatus({
          isActive: campaign.is_active,
          startsAt: campaign.starts_at,
          endsAt: campaign.ends_at,
        }) === "vigente"
    ).length;
    const activeCoupons = coupons.filter(
      (coupon) =>
        getCommercialStatus({
          isActive: coupon.is_active,
          startsAt: coupon.starts_at,
          endsAt: coupon.ends_at,
          redemptionCount: coupon.redemption_count,
          maxRedemptions: coupon.max_redemptions,
        }) === "vigente"
    ).length;

    return {
      activeCampaigns,
      activeCoupons,
      totalActive: activeCampaigns + activeCoupons,
    };
  }, [campaigns, coupons]);

  const clearFeedback = () => {
    setError("");
    setSuccessMessage("");
  };

  const refreshWorkspace = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const submitJson = async (pathname: string, method: "POST" | "PATCH", body: unknown) => {
    const response = await fetch(pathname, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      throw new Error(payload?.message || "No se pudo completar la operacion comercial.");
    }
  };

  const handleCampaignSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    setActingKey(campaignForm.id ? `campaign-update-${campaignForm.id}` : "campaign-create");

    try {
      await submitJson(
        campaignForm.id
          ? `/api/seller/products/${productId}/campaigns/${campaignForm.id}`
          : `/api/seller/products/${productId}/campaigns`,
        campaignForm.id ? "PATCH" : "POST",
        {
          title: campaignForm.title,
          campaignType: campaignForm.campaignType,
          discountType:
            campaignForm.campaignType === "featured_placement" ? null : campaignForm.discountType,
          discountValue:
            campaignForm.campaignType === "featured_placement"
              ? null
              : parseDiscountValue(campaignForm.discountValue),
          startsAt: fromDateInput(campaignForm.startsAt),
          endsAt: fromDateInput(campaignForm.endsAt),
          isActive: campaignForm.isActive,
        }
      );

      setCampaignForm(EMPTY_CAMPAIGN_FORM);
      setSuccessMessage(
        campaignForm.id
          ? "La campana se actualizo correctamente."
          : "La campana del producto se creo correctamente."
      );
      refreshWorkspace();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la campana del producto."
      );
    } finally {
      setActingKey(null);
    }
  };

  const handleCouponSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    setActingKey(couponForm.id ? `coupon-update-${couponForm.id}` : "coupon-create");

    try {
      await submitJson(
        couponForm.id
          ? `/api/seller/products/${productId}/coupons/${couponForm.id}`
          : `/api/seller/products/${productId}/coupons`,
        couponForm.id ? "PATCH" : "POST",
        {
          code: couponForm.code,
          discountType: couponForm.discountType,
          discountValue: parseDiscountValue(couponForm.discountValue),
          startsAt: fromDateInput(couponForm.startsAt),
          endsAt: fromDateInput(couponForm.endsAt),
          maxRedemptions: couponForm.maxRedemptions.trim()
            ? Number.parseInt(couponForm.maxRedemptions, 10)
            : null,
          isActive: couponForm.isActive,
        }
      );

      setCouponForm(EMPTY_COUPON_FORM);
      setSuccessMessage(
        couponForm.id
          ? "El cupon se actualizo correctamente."
          : "El cupon del producto se creo correctamente."
      );
      refreshWorkspace();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "No se pudo guardar el cupon."
      );
    } finally {
      setActingKey(null);
    }
  };

  const handleCampaignDelete = async (campaignId: string) => {
    clearFeedback();
    setActingKey(`campaign-delete-${campaignId}`);

    try {
      const response = await fetch(`/api/seller/products/${productId}/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo eliminar la campana.");
      }

      if (campaignForm.id === campaignId) {
        setCampaignForm(EMPTY_CAMPAIGN_FORM);
      }

      setSuccessMessage("La campana se elimino correctamente.");
      refreshWorkspace();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la campana."
      );
    } finally {
      setActingKey(null);
    }
  };

  const handleCouponDelete = async (couponId: string) => {
    clearFeedback();
    setActingKey(`coupon-delete-${couponId}`);

    try {
      const response = await fetch(`/api/seller/products/${productId}/coupons/${couponId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo eliminar el cupon.");
      }

      if (couponForm.id === couponId) {
        setCouponForm(EMPTY_COUPON_FORM);
      }

      setSuccessMessage("El cupon se elimino correctamente.");
      refreshWorkspace();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el cupon.");
    } finally {
      setActingKey(null);
    }
  };

  const startCampaignEdit = (campaign: SellerProductCampaignItem) => {
    clearFeedback();
    setCampaignForm({
      id: campaign.id,
      title: campaign.title,
      campaignType: campaign.campaign_type,
      discountType: campaign.discount_type || "percent",
      discountValue:
        campaign.discount_type && campaign.discount_value !== null
          ? campaign.discount_type === "fixed"
            ? (campaign.discount_value / 100).toFixed(2)
            : String(campaign.discount_value)
          : "",
      startsAt: toLocalDateTimeValue(campaign.starts_at),
      endsAt: toLocalDateTimeValue(campaign.ends_at),
      isActive: campaign.is_active,
    });
  };

  const startCouponEdit = (coupon: SellerProductCouponItem) => {
    clearFeedback();
    setCouponForm({
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue:
        coupon.discount_type === "fixed"
          ? (coupon.discount_value / 100).toFixed(2)
          : String(coupon.discount_value),
      startsAt: toLocalDateTimeValue(coupon.starts_at),
      endsAt: toLocalDateTimeValue(coupon.ends_at),
      maxRedemptions: coupon.max_redemptions ? String(coupon.max_redemptions) : "",
      isActive: coupon.is_active,
    });
  };

  const resetForms = () => {
    clearFeedback();
    setCampaignForm(EMPTY_CAMPAIGN_FORM);
    setCouponForm(EMPTY_COUPON_FORM);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_rgba(255,255,255,0.03)_40%,_rgba(0,0,0,0.2)_100%)] p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
              Product Commerce
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">{productTitle}</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
              Centro comercial del producto para gobernar campanas, cupones, vigencia y senales
              basicas de impacto sin salir del workspace seller.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge className="border-white/10 bg-white/5 text-[var(--text-soft)]">
                Release activa: {activeReleaseVersion ? `v${activeReleaseVersion}` : "Sin activa"}
              </Badge>
              <Badge className="border-white/10 bg-white/5 text-[var(--text-soft)]">
                Precio base: {formatCurrency(priceCents)}
              </Badge>
              <Badge
                className={
                  activeCommercialItems.totalActive > 0
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-white/10 bg-white/5 text-[var(--text-soft)]"
                }
              >
                {activeCommercialItems.totalActive > 0
                  ? `${activeCommercialItems.totalActive} promos vigentes`
                  : "Sin promos vigentes"}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/seller/products/${productId}`}>
              <Button variant="ghost">Volver al workspace</Button>
            </Link>
            <Link href={`/products/${productSlug}`}>
              <Button variant="ghost">Ver ficha publica</Button>
            </Link>
            <Link href="/seller">
              <Button variant="secondary">Panel seller</Button>
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Campanas</p>
            <p className="mt-2 text-2xl font-bold text-white">{campaigns.length}</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              {activeCommercialItems.activeCampaigns} vigentes ahora
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Cupones</p>
            <p className="mt-2 text-2xl font-bold text-white">{coupons.length}</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              {activeCommercialItems.activeCoupons} vigentes ahora
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Compras 30d</p>
            <p className="mt-2 text-2xl font-bold text-white">{metrics.purchases}</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">{metrics.views} vistas</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Ingresos 30d</p>
            <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(metrics.revenueCents)}</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">Salud comercial reciente</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">Continuidad</p>
            <p className="mt-2 text-lg font-semibold text-white">Workspace conectado</p>
            <p className="mt-1 text-sm text-[var(--text-soft)]">
              Producto, soporte y capa comercial ya viven en el mismo centro de mando.
            </p>
          </div>
        </div>
      </section>

      {(error || successMessage) ? (
        <section className="space-y-3">
          {error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          {successMessage ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {successMessage}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-8 xl:grid-cols-2">
        <form onSubmit={handleCampaignSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {campaignForm.id ? "Editar campana" : "Nueva campana del producto"}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Controla flash deals, launch discounts o placements destacados ligados a este
                producto.
              </p>
            </div>
            {campaignForm.id ? (
              <Button type="button" variant="ghost" onClick={resetForms}>
                Cancelar
              </Button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-white">Titulo</label>
              <input
                type="text"
                value={campaignForm.title}
                onChange={(event) =>
                  setCampaignForm((current) => ({ ...current, title: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                placeholder="Weekend sale"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">Tipo</label>
              <select
                value={campaignForm.campaignType}
                onChange={(event) =>
                  setCampaignForm((current) => ({
                    ...current,
                    campaignType: event.target.value as CampaignType,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                disabled={isPending}
              >
                <option value="flash_deal">Flash deal</option>
                <option value="launch_discount">Launch discount</option>
                <option value="featured_placement">Featured placement</option>
              </select>
            </div>
            {campaignForm.campaignType !== "featured_placement" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-white">Tipo de descuento</label>
                  <select
                    value={campaignForm.discountType}
                    onChange={(event) =>
                      setCampaignForm((current) => ({
                        ...current,
                        discountType: event.target.value as DiscountType,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                    disabled={isPending}
                  >
                    <option value="percent">Porcentaje</option>
                    <option value="fixed">Importe fijo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white">
                    {campaignForm.discountType === "fixed" ? "Descuento en EUR" : "Descuento en %"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={campaignForm.discountType === "fixed" ? "0.01" : "1"}
                    value={campaignForm.discountValue}
                    onChange={(event) =>
                      setCampaignForm((current) => ({
                        ...current,
                        discountValue: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                    disabled={isPending}
                  />
                </div>
              </>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-white">Inicio</label>
              <input
                type="datetime-local"
                value={campaignForm.startsAt}
                onChange={(event) =>
                  setCampaignForm((current) => ({ ...current, startsAt: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">Fin</label>
              <input
                type="datetime-local"
                value={campaignForm.endsAt}
                onChange={(event) =>
                  setCampaignForm((current) => ({ ...current, endsAt: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                disabled={isPending}
              />
            </div>
          </div>

          <label className="mt-5 flex items-center gap-2 text-sm font-medium text-white">
            <input
              type="checkbox"
              checked={campaignForm.isActive}
              onChange={(event) =>
                setCampaignForm((current) => ({ ...current, isActive: event.target.checked }))
              }
              disabled={isPending}
            />
            Campana activa
          </label>

          <div className="mt-5 flex justify-end">
            <Button type="submit" disabled={isPending}>
              {actingKey?.startsWith("campaign-")
                ? campaignForm.id
                  ? "Guardando..."
                  : "Creando..."
                : campaignForm.id
                  ? "Guardar campana"
                  : "Crear campana"}
            </Button>
          </div>
        </form>

        <form onSubmit={handleCouponSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {couponForm.id ? "Editar cupon" : "Nuevo cupon del producto"}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Crea descuentos directos del producto con control de vigencia y limite de usos.
              </p>
            </div>
            {couponForm.id ? (
              <Button type="button" variant="ghost" onClick={resetForms}>
                Cancelar
              </Button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-white">Codigo</label>
              <input
                type="text"
                value={couponForm.code}
                onChange={(event) =>
                  setCouponForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                placeholder="SPRING25"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">Tipo de descuento</label>
              <select
                value={couponForm.discountType}
                onChange={(event) =>
                  setCouponForm((current) => ({
                    ...current,
                    discountType: event.target.value as DiscountType,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                disabled={isPending}
              >
                <option value="percent">Porcentaje</option>
                <option value="fixed">Importe fijo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white">
                {couponForm.discountType === "fixed" ? "Descuento en EUR" : "Descuento en %"}
              </label>
              <input
                type="number"
                min="0"
                step={couponForm.discountType === "fixed" ? "0.01" : "1"}
                value={couponForm.discountValue}
                onChange={(event) =>
                  setCouponForm((current) => ({ ...current, discountValue: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">Maximo de usos</label>
              <input
                type="number"
                min="1"
                value={couponForm.maxRedemptions}
                onChange={(event) =>
                  setCouponForm((current) => ({
                    ...current,
                    maxRedemptions: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                placeholder="Opcional"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">Inicio</label>
              <input
                type="datetime-local"
                value={couponForm.startsAt}
                onChange={(event) =>
                  setCouponForm((current) => ({ ...current, startsAt: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">Fin</label>
              <input
                type="datetime-local"
                value={couponForm.endsAt}
                onChange={(event) =>
                  setCouponForm((current) => ({ ...current, endsAt: event.target.value }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none transition focus:border-white/30"
                disabled={isPending}
              />
            </div>
          </div>

          <label className="mt-5 flex items-center gap-2 text-sm font-medium text-white">
            <input
              type="checkbox"
              checked={couponForm.isActive}
              onChange={(event) =>
                setCouponForm((current) => ({ ...current, isActive: event.target.checked }))
              }
              disabled={isPending}
            />
            Cupon activo
          </label>

          <div className="mt-5 flex justify-end">
            <Button type="submit" disabled={isPending}>
              {actingKey?.startsWith("coupon-")
                ? couponForm.id
                  ? "Guardando..."
                  : "Creando..."
                : couponForm.id
                  ? "Guardar cupon"
                  : "Crear cupon"}
            </Button>
          </div>
        </form>
      </section>

      <section className="grid gap-8 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Campanas del producto</h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Visibilidad directa de estado, vigencia y acceso rapido a edicion.
              </p>
            </div>
            <Badge>{campaigns.length} campanas</Badge>
          </div>

          {campaigns.length > 0 ? (
            <div className="mt-6 space-y-4">
              {campaigns.map((campaign) => {
                const status = getCommercialStatus({
                  isActive: campaign.is_active,
                  startsAt: campaign.starts_at,
                  endsAt: campaign.ends_at,
                });

                return (
                  <article key={campaign.id} className="rounded-2xl border border-white/10 bg-black/10 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{campaign.title}</h3>
                          <Badge className={statusBadgeClass(status)}>{status}</Badge>
                          <Badge className="border-white/10 bg-white/5 text-[var(--text-soft)]">
                            {campaign.campaign_type}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-3 text-sm text-[var(--text-soft)] md:grid-cols-2">
                          <p>
                            Descuento:{" "}
                            <span className="text-white">
                              {formatDiscount(campaign.discount_type, campaign.discount_value)}
                            </span>
                          </p>
                          <p>
                            Vigencia:{" "}
                            <span className="text-white">
                              {formatWindow(campaign.starts_at, campaign.ends_at)}
                            </span>
                          </p>
                          <p>
                            Creada:{" "}
                            <span className="text-white">
                              {new Date(campaign.created_at).toLocaleDateString("es-ES")}
                            </span>
                          </p>
                          <p>
                            Ultima edicion:{" "}
                            <span className="text-white">
                              {new Date(campaign.updated_at).toLocaleDateString("es-ES")}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={isPending}
                          onClick={() => startCampaignEdit(campaign)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={isPending || actingKey === `campaign-delete-${campaign.id}`}
                          onClick={() => void handleCampaignDelete(campaign.id)}
                        >
                          {actingKey === `campaign-delete-${campaign.id}` ? "Eliminando..." : "Eliminar"}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center">
              <p className="text-[var(--text-soft)]">Aun no hay campanas para este producto.</p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Cupones del producto</h2>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Control de vigencia, limite de usos y estado operativo del descuento directo.
              </p>
            </div>
            <Badge>{coupons.length} cupones</Badge>
          </div>

          {coupons.length > 0 ? (
            <div className="mt-6 space-y-4">
              {coupons.map((coupon) => {
                const status = getCommercialStatus({
                  isActive: coupon.is_active,
                  startsAt: coupon.starts_at,
                  endsAt: coupon.ends_at,
                  redemptionCount: coupon.redemption_count,
                  maxRedemptions: coupon.max_redemptions,
                });

                return (
                  <article key={coupon.id} className="rounded-2xl border border-white/10 bg-black/10 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{coupon.code}</h3>
                          <Badge className={statusBadgeClass(status)}>{status}</Badge>
                          <Badge className="border-white/10 bg-white/5 text-[var(--text-soft)]">
                            {formatDiscount(coupon.discount_type, coupon.discount_value)}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-3 text-sm text-[var(--text-soft)] md:grid-cols-2">
                          <p>
                            Vigencia:{" "}
                            <span className="text-white">
                              {formatWindow(coupon.starts_at, coupon.ends_at)}
                            </span>
                          </p>
                          <p>
                            Canjes:{" "}
                            <span className="text-white">
                              {coupon.redemption_count}
                              {coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : " sin limite"}
                            </span>
                          </p>
                          <p>
                            Creado:{" "}
                            <span className="text-white">
                              {new Date(coupon.created_at).toLocaleDateString("es-ES")}
                            </span>
                          </p>
                          <p>
                            Estado comercial: <span className="text-white">{status}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={isPending}
                          onClick={() => startCouponEdit(coupon)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={isPending || actingKey === `coupon-delete-${coupon.id}`}
                          onClick={() => void handleCouponDelete(coupon.id)}
                        >
                          {actingKey === `coupon-delete-${coupon.id}` ? "Eliminando..." : "Eliminar"}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center">
              <p className="text-[var(--text-soft)]">Aun no hay cupones para este producto.</p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold text-white">Reglas comerciales del producto</h2>
        <div className="mt-5 grid gap-3 text-sm text-[var(--text-soft)] md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
            <p className="font-semibold text-white">Campanas</p>
            <p className="mt-2">Se aplican automaticamente si estan vigentes y son las mejores disponibles para el producto.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
            <p className="font-semibold text-white">Cupones</p>
            <p className="mt-2">Compiten con las campanas en checkout y solo gana el descuento mas beneficioso para el buyer.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
            <p className="font-semibold text-white">Vigencia</p>
            <p className="mt-2">El estado combina activacion manual, ventana temporal y agotamiento de usos en cupones.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
            <p className="font-semibold text-white">Continuidad</p>
            <p className="mt-2">Workspace, soporte, releases y capa comercial ya se gobiernan desde rutas conectadas del mismo producto.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
