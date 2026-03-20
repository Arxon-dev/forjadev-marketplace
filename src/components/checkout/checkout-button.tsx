"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trackMarketplaceEvent } from "@/lib/analytics/marketplace";

interface CheckoutButtonProps {
  productId: string;
  productPriceCents?: number;
  currency?: string;
  initialCouponCode?: string;
  endpointPath?: string;
  submitLabel?: string;
  allowCoupons?: boolean;
}

export function CheckoutButton({
  productId,
  productPriceCents = 0,
  currency = "EUR",
  initialCouponCode = "",
  endpointPath,
  submitLabel = "Comprar ahora",
  allowCoupons = true,
}: CheckoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState(initialCouponCode.toUpperCase());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [discountSummary, setDiscountSummary] = useState("");

  const handleCheckout = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    setDiscountSummary("");

    trackMarketplaceEvent({
      eventName: "checkout.started",
      pageType: endpointPath?.includes("/bundles/") ? "bundle_checkout" : "checkout",
      entityType: endpointPath?.includes("/bundles/") ? "bundle" : "product",
      entityId: productId,
      metadata: {
        hasCouponCode: Boolean(couponCode.trim()),
        priceCents: productPriceCents,
      },
    });

    try {
      const response = await fetch(endpointPath || `/api/checkout/${productId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          couponCode: couponCode.trim() || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            message?: string;
            orderId?: string;
            couponCode?: string | null;
            discountCents?: number;
            totalCents?: number;
          }
        | null;

      if (!response.ok) {
        setError(payload?.message || "No se pudo completar la compra");
        return;
      }

      setSuccess(payload?.message || "Compra completada");
      if ((payload?.discountCents || 0) > 0) {
        setDiscountSummary(
          `Cupon ${payload?.couponCode || ""} aplicado: -${currency} ${(
            (payload?.discountCents || 0) / 100
          ).toFixed(2)} | Total ${currency} ${((payload?.totalCents || 0) / 100).toFixed(2)}`
        );
      }
      router.refresh();

      setTimeout(() => {
        router.push(payload?.orderId ? `/orders?highlightOrder=${payload.orderId}` : "/orders");
      }, 800);
    } catch {
      setError("No se pudo completar la compra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {allowCoupons ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">Cupon</label>
          <input
            type="text"
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
            placeholder="PROMO10"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            disabled={loading}
          />
          <p className="text-xs text-[var(--text-soft)]">
            Precio base: {currency} {(productPriceCents / 100).toFixed(2)}
          </p>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-soft)]">
          Precio bundle: {currency} {(productPriceCents / 100).toFixed(2)}
        </p>
      )}
      <Button onClick={handleCheckout} disabled={loading}>
        {loading ? "Procesando..." : submitLabel}
      </Button>
      {discountSummary ? (
        <p className="text-sm text-emerald-300">{discountSummary}</p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-300">{success}</p>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
