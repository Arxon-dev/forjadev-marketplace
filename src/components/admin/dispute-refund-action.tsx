"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface DisputeRefundActionProps {
  disputeId: string;
  canRefund: boolean;
  currentOrderStatus: string | null;
}

export function DisputeRefundAction({
  disputeId,
  canRefund,
  currentOrderStatus,
}: DisputeRefundActionProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleRefund = async () => {
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/disputes/${disputeId}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo emitir el reembolso");
      }

      setMessage(payload?.message || "Reembolso emitido");
      router.refresh();
    } catch (refundError) {
      setError(refundError instanceof Error ? refundError.message : "No se pudo emitir el reembolso");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/10 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
        Resultado economico
      </p>
      <p className="text-sm text-[var(--text-soft)]">
        {currentOrderStatus === "refunded"
          ? "Este pedido ya figura como reembolsado."
          : "Si corresponde devolver la compra, esta accion marca el pedido como reembolsado, revoca la licencia asociada y cierra la disputa como resuelta."}
      </p>

      <Button type="button" variant="primary" disabled={!canRefund || submitting} onClick={handleRefund}>
        {submitting ? "Procesando..." : "Emitir reembolso y cerrar caso"}
      </Button>

      {!canRefund && currentOrderStatus !== "refunded" ? (
        <p className="text-xs text-[var(--text-soft)]">
          Solo puedes reembolsar disputas con pedido asociado y que no esten rechazadas ni reembolsadas ya.
        </p>
      ) : null}
      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
