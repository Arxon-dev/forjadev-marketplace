"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface LicenseActionsProps {
  licenseId: string;
  currentStatus: "active" | "revoked";
}

export function LicenseActions({ licenseId, currentStatus }: LicenseActionsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const nextAction = currentStatus === "active" ? "revoke" : "reactivate";
  const nextLabel = currentStatus === "active" ? "Revocar" : "Reactivar";

  const handleAction = async () => {
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/licenses/${licenseId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: nextAction }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo actualizar la licencia");
      }

      setMessage(payload?.message || "Licencia actualizada");
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo actualizar la licencia"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant={currentStatus === "active" ? "danger" : "primary"}
        disabled={submitting}
        onClick={handleAction}
      >
        {submitting ? "Actualizando..." : nextLabel}
      </Button>

      {message ? (
        <p className="text-sm text-emerald-300">{message}</p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
