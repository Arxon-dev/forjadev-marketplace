"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface SellerCampaignManagerProps {
  vendorId: string;
}

type TargetType = "product" | "bundle";
type CampaignType = "flash_deal" | "launch_discount" | "featured_placement";
type DiscountType = "percent" | "fixed";

interface TargetOption {
  id: string;
  title: string;
}

interface CampaignRow {
  id: string;
  title: string;
  campaign_type: CampaignType;
  discount_type: DiscountType | null;
  discount_value: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  product_id: string | null;
  bundle_id: string | null;
}

export function SellerCampaignManager({ vendorId }: SellerCampaignManagerProps) {
  const [targetType, setTargetType] = useState<TargetType>("product");
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType>("flash_deal");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [products, setProducts] = useState<TargetOption[]>([]);
  const [bundles, setBundles] = useState<TargetOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: productRows }, { data: bundleRows }, { data: campaignRows }] = await Promise.all([
      supabase
        .from("products")
        .select("id, title")
        .eq("vendor_id", vendorId)
        .eq("moderation_status", "approved")
        .order("updated_at", { ascending: false }),
      supabase
        .from("bundles")
        .select("id, title")
        .eq("vendor_id", vendorId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("campaigns")
        .select(
          "id, title, campaign_type, discount_type, discount_value, starts_at, ends_at, is_active, product_id, bundle_id"
        )
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false }),
    ]);

    setProducts((productRows || []) as TargetOption[]);
    setBundles((bundleRows || []) as TargetOption[]);
    setCampaigns((campaignRows || []) as CampaignRow[]);
    setLoading(false);
  }, [vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentTargets = targetType === "product" ? products : bundles;

  useEffect(() => {
    if (!currentTargets.some((item) => item.id === targetId)) {
      setTargetId(currentTargets[0]?.id || "");
    }
  }, [currentTargets, targetId]);

  const resetForm = () => {
    setTitle("");
    setCampaignType("flash_deal");
    setDiscountType("percent");
    setDiscountValue("");
    setStartsAt("");
    setEndsAt("");
    setIsActive(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!targetId) {
      setError("Selecciona un objetivo para la campana");
      return;
    }

    if (!title.trim()) {
      setError("Define un titulo para la campana");
      return;
    }

    if (campaignType !== "featured_placement" && !discountValue.trim()) {
      setError("Debes indicar un descuento para la campana");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const payload = {
        vendor_id: vendorId,
        title: title.trim(),
        campaign_type: campaignType,
        discount_type: campaignType === "featured_placement" ? null : discountType,
        discount_value:
          campaignType === "featured_placement"
            ? null
            : discountType === "fixed"
              ? Math.round((Number.parseFloat(discountValue) || 0) * 100)
              : Math.round(Number.parseFloat(discountValue) || 0),
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        is_active: isActive,
        product_id: targetType === "product" ? targetId : null,
        bundle_id: targetType === "bundle" ? targetId : null,
      };

      const { error: insertError } = await supabase.from("campaigns").insert([payload]);
      if (insertError) {
        throw insertError;
      }

      resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la campana");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCampaignStatus = async (campaign: CampaignRow) => {
    const supabase = createClient();
    await supabase
      .from("campaigns")
      .update({ is_active: !campaign.is_active })
      .eq("id", campaign.id);
    await load();
  };

  const deleteCampaign = async (campaignId: string) => {
    const supabase = createClient();
    await supabase.from("campaigns").delete().eq("id", campaignId);
    await load();
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Campanas y promociones</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Lanza flash deals, descuentos de lanzamiento y placements destacados sin depender de admin.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-5">
        {error ? <div className="mb-4 rounded-lg bg-red-500/10 p-4 text-sm text-red-400">{error}</div> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-white">Tipo de objetivo</label>
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as TargetType)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
              disabled={submitting || loading}
            >
              <option value="product">Producto</option>
              <option value="bundle">Bundle</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white">Objetivo</label>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
              disabled={submitting || loading}
            >
              <option value="">Seleccionar...</option>
              {currentTargets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white">Campana</label>
            <select
              value={campaignType}
              onChange={(event) => setCampaignType(event.target.value as CampaignType)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
              disabled={submitting || loading}
            >
              <option value="flash_deal">Flash deal</option>
              <option value="launch_discount">Launch discount</option>
              <option value="featured_placement">Featured placement</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white">Titulo</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
              placeholder="Weekend admin sale"
              disabled={submitting || loading}
            />
          </div>

          {campaignType !== "featured_placement" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-white">Tipo de descuento</label>
                <select
                  value={discountType}
                  onChange={(event) => setDiscountType(event.target.value as DiscountType)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
                  disabled={submitting || loading}
                >
                  <option value="percent">Porcentaje</option>
                  <option value="fixed">Importe fijo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white">
                  {discountType === "fixed" ? "Descuento en EUR" : "Descuento en %"}
                </label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                  min="0"
                  step={discountType === "fixed" ? "0.01" : "1"}
                  disabled={submitting || loading}
                />
              </div>
            </>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-white">Inicio</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
              disabled={submitting || loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white">Fin</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
              disabled={submitting || loading}
            />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm font-medium text-white">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4 rounded border-white/10 bg-white/5"
            disabled={submitting || loading}
          />
          Campana activa
        </label>

        <div className="mt-5">
          <Button type="submit" disabled={submitting || loading}>
            {submitting ? "Guardando..." : "Crear campana"}
          </Button>
        </div>
      </form>

      <div className="mt-8 rounded-2xl border border-white/10 bg-black/10">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
          <span>Campana</span>
          <span>Objetivo</span>
          <span>Ventana</span>
          <span>Acciones</span>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-[var(--text-soft)]">Cargando campanas...</div>
        ) : campaigns.length > 0 ? (
          <div className="divide-y divide-white/10">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 py-4 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{campaign.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                    {campaign.campaign_type}
                    {campaign.discount_type && campaign.discount_value
                      ? campaign.discount_type === "fixed"
                        ? ` | EUR ${(campaign.discount_value / 100).toFixed(2)}`
                        : ` | ${campaign.discount_value}%`
                      : ""}
                  </p>
                </div>
                <div className="text-[var(--text-soft)]">
                  {campaign.product_id ? "Producto" : "Bundle"}
                </div>
                <div className="text-[var(--text-soft)]">
                  {campaign.starts_at
                    ? new Date(campaign.starts_at).toLocaleDateString("es-ES")
                    : "Ahora"}
                  {" - "}
                  {campaign.ends_at
                    ? new Date(campaign.ends_at).toLocaleDateString("es-ES")
                    : "Sin fin"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => void toggleCampaignStatus(campaign)}>
                    {campaign.is_active ? "Desactivar" : "Activar"}
                  </Button>
                  <Button variant="ghost" onClick={() => void deleteCampaign(campaign.id)}>
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-[var(--text-soft)]">
            Aun no hay campanas creadas.
          </div>
        )}
      </div>
    </div>
  );
}
