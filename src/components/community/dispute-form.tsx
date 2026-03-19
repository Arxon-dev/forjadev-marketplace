"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface DisputeFormProps {
  orderId: string;
  productId: string;
  licenseId?: string | null;
  productTitle: string;
}

export function DisputeForm({ orderId, productId, licenseId = null, productTitle }: DisputeFormProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!reason.trim()) {
      setError("Describe el motivo de la disputa para que el equipo pueda revisarla.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/disputes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          productId,
          licenseId,
          reason,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string; disputeId?: string }
        | null;

      if (!response.ok || !payload?.disputeId) {
        throw new Error(payload?.message || "No se pudo abrir la disputa");
      }

      setMessage(payload.message || "Disputa abierta correctamente");
      setReason("");
      setIsOpen(false);
      router.refresh();
      router.push("/disputes");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo abrir la disputa");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button type="button" variant="ghost" onClick={() => setIsOpen((value) => !value)}>
        {isOpen ? "Cancelar disputa" : "Abrir disputa"}
      </Button>

      {isOpen ? (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold text-white">Disputa para {productTitle}</p>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Usa este flujo si necesitas revision administrativa por licencia, entrega o cobro.
          </p>

          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            disabled={submitting}
            className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="Explica el problema, lo que esperabas recibir y cualquier contexto util."
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Abriendo..." : "Enviar a revision"}
            </Button>
            <Button type="button" variant="secondary" disabled={submitting} onClick={() => setIsOpen(false)}>
              Cerrar
            </Button>
          </div>
        </form>
      ) : null}

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
