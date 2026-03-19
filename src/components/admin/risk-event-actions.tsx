"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface RiskEventActionsProps {
  riskEventId: string;
  currentStatus: "open" | "resolved" | "ignored";
}

const ACTION_LABELS = {
  open: "Reabrir",
  resolved: "Resolver",
  ignored: "Ignorar",
} as const;

export function RiskEventActions({ riskEventId, currentStatus }: RiskEventActionsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<"resolved" | "ignored" | "open" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const actions =
    currentStatus === "open"
      ? (["resolved", "ignored"] as const)
      : (["open"] as const);

  const handleAction = async (status: "open" | "resolved" | "ignored") => {
    setSubmitting(status);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/risk/${riskEventId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo actualizar el evento de riesgo");
      }

      setMessage(payload?.message || "Evento de riesgo actualizado");
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo actualizar el evento de riesgo"
      );
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            variant={action === "ignored" ? "secondary" : action === "resolved" ? "primary" : "ghost"}
            disabled={submitting !== null}
            onClick={() => handleAction(action)}
          >
            {submitting === action ? "Actualizando..." : ACTION_LABELS[action]}
          </Button>
        ))}
      </div>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
