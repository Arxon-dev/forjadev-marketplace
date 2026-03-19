"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type RangeKey = "7d" | "30d" | "90d";

interface SellerAnalyticsPanelProps {
  vendorId: string;
}

interface ProductAnalyticsRow {
  id: string;
  title: string;
  slug: string;
  moderationStatus: string;
  views: number;
  clicks: number;
  addToCarts: number;
  purchases: number;
  downloads: number;
  revenueCents: number;
  conversionRate: number;
  ratingAverage: number;
  ratingCount: number;
  activeCoupons: number;
  activeCampaigns?: number;
  updatedAt: string;
}

interface AnalyticsPayload {
  range: RangeKey;
  sellerHealth?: {
    reputationScore: number;
    riskScore: number;
    healthScore: number;
    openDisputes: number;
    openRiskEvents: number;
  };
  summary: {
    products: number;
    views: number;
    clicks: number;
    addToCarts: number;
    purchases: number;
    downloads: number;
    revenueCents: number;
    activeCoupons: number;
    activeCampaigns?: number;
    conversionRate: number;
  };
  products: ProductAnalyticsRow[];
}

function formatCurrency(cents: number) {
  return `EUR ${(cents / 100).toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function SellerAnalyticsPanel({ vendorId }: SellerAnalyticsPanelProps) {
  const [range, setRange] = useState<RangeKey>("30d");
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const response = await fetch(`/api/seller/analytics/${vendorId}?range=${range}`);
      const data = (await response.json().catch(() => null)) as AnalyticsPayload | null;
      setPayload(data);
      setLoading(false);
    };

    void load();
  }, [range, vendorId]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Analytics comerciales</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Vigila demanda, conversion y rendimiento por producto para tomar decisiones de precio,
            promociones y roadmap.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["7d", "30d", "90d"] as RangeKey[]).map((option) => (
            <Button
              key={option}
              variant={range === option ? "primary" : "secondary"}
              onClick={() => setRange(option)}
              disabled={loading}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-[var(--text-soft)]">Cargando analytics...</p>
      ) : payload ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-7">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-sm text-[var(--text-soft)]">Vistas</p>
              <p className="mt-2 text-2xl font-bold text-white">{payload.summary.views}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-sm text-[var(--text-soft)]">Clicks</p>
              <p className="mt-2 text-2xl font-bold text-white">{payload.summary.clicks}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-sm text-[var(--text-soft)]">Intent</p>
              <p className="mt-2 text-2xl font-bold text-white">{payload.summary.addToCarts}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-sm text-[var(--text-soft)]">Compras</p>
              <p className="mt-2 text-2xl font-bold text-white">{payload.summary.purchases}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-sm text-[var(--text-soft)]">Conversion</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {formatPercent(payload.summary.conversionRate)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-sm text-[var(--text-soft)]">Ingresos</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {formatCurrency(payload.summary.revenueCents)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-sm text-[var(--text-soft)]">Promos activas</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {(payload.summary.activeCoupons || 0) + (payload.summary.activeCampaigns || 0)}
              </p>
            </div>
          </div>

          {payload.sellerHealth ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-[var(--text-soft)]">Seller health</p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {payload.sellerHealth.healthScore}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-[var(--text-soft)]">Trust score</p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {payload.sellerHealth.reputationScore}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-[var(--text-soft)]">Risk score</p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {payload.sellerHealth.riskScore}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm text-[var(--text-soft)]">Casos abiertos</p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {payload.sellerHealth.openDisputes + payload.sellerHealth.openRiskEvents}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/10">
            <div className="grid grid-cols-[minmax(0,2fr)_repeat(7,minmax(0,1fr))] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
              <span>Producto</span>
              <span>Vistas</span>
              <span>Clicks</span>
              <span>Intent</span>
              <span>Compras</span>
              <span>Conv.</span>
              <span>Ingresos</span>
              <span>Promos</span>
            </div>

            {payload.products.length > 0 ? (
              <div className="divide-y divide-white/10">
                {payload.products.slice(0, 8).map((product) => (
                  <div
                    key={product.id}
                    className="grid grid-cols-[minmax(0,2fr)_repeat(7,minmax(0,1fr))] gap-3 px-4 py-4 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-white">{product.title}</div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--text-soft)]">
                        <span className="capitalize">{product.moderationStatus}</span>
                        <span>
                          {product.ratingCount > 0
                            ? `${product.ratingAverage.toFixed(1)}/5 | ${product.ratingCount} resenas`
                            : "Sin resenas"}
                        </span>
                      </div>
                      {product.slug ? (
                        <Link
                          href={`/products/${product.slug}`}
                          className="mt-2 inline-block text-xs text-[var(--primary)] hover:text-white"
                        >
                          Ver producto
                        </Link>
                      ) : null}
                    </div>
                    <span className="text-white">{product.views}</span>
                    <span className="text-white">{product.clicks}</span>
                    <span className="text-white">{product.addToCarts}</span>
                    <span className="text-white">{product.purchases}</span>
                    <span className="text-white">{formatPercent(product.conversionRate)}</span>
                    <span className="text-white">{formatCurrency(product.revenueCents)}</span>
                    <span className="text-white">
                      {(product.activeCoupons || 0) + (product.activeCampaigns || 0)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-[var(--text-soft)]">
                Todavia no hay datos suficientes para este rango.
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="mt-6 text-[var(--text-soft)]">
          No se pudieron cargar los analytics del seller.
        </p>
      )}
    </div>
  );
}
