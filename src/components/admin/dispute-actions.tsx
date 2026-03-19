"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface DisputeActionsProps {
  disputeId: string;
  currentStatus: "open" | "reviewing" | "resolved" | "rejected";
}

const STATUS_LABELS = {
  open: "Reabrir",
  reviewing: "Tomar revision",
  resolved: "Resolver",
  rejected: "Rechazar",
} as const;

export function DisputeActions({ disputeId, currentStatus }: DisputeActionsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const nextStatuses =
    currentStatus === "open"
      ? (["reviewing", "resolved", "rejected"] as const)
      : currentStatus === "reviewing"
        ? (["resolved", "rejected", "open"] as const)
        : (["open"] as const);

  const handleAction = async (status: "open" | "reviewing" | "resolved" | "rejected") => {
    setSubmitting(status);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/disputes/${disputeId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo actualizar la disputa");
      }

      setMessage(payload?.message || "Disputa actualizada");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo actualizar la disputa");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((status) => (
          <Button
            key={status}
            type="button"
            variant={status === "rejected" ? "danger" : status === "resolved" ? "primary" : "secondary"}
            disabled={submitting !== null}
            onClick={() => handleAction(status)}
          >
            {submitting === status ? "Actualizando..." : STATUS_LABELS[status]}
          </Button>
        ))}
      </div>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
