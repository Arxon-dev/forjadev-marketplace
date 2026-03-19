"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface CampaignActionsProps {
  campaignId: string;
  isActive: boolean;
}

export function CampaignActions({ campaignId, isActive }: CampaignActionsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const action = isActive ? "pause" : "activate";
  const label = isActive ? "Pausar" : "Reactivar";

  const handleAction = async () => {
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo actualizar la campana");
      }

      setMessage(payload?.message || "Campana actualizada");
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo actualizar la campana"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant={isActive ? "danger" : "primary"}
        disabled={submitting}
        onClick={handleAction}
      >
        {submitting ? "Actualizando..." : label}
      </Button>

      {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
