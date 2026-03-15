"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ModerationActionsProps {
  productId: string;
  currentStatus: string;
}

export function ModerationActions({
  productId,
  currentStatus,
}: ModerationActionsProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const submitAction = async (action: "approve" | "reject" | "hide" | "pending") => {
    setError("");
    setSuccess("");
    setLoadingAction(action);

    try {
      const response = await fetch(`/api/admin/products/${productId}/moderate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          reason: action === "reject" ? reason : undefined,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setError(payload?.message || "No se pudo actualizar la moderacion");
        return;
      }

      if (action !== "reject") {
        setReason("");
      }

      setSuccess(payload?.message || "Estado actualizado correctamente");
      router.refresh();
    } catch {
      setError("No se pudo actualizar la moderacion");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold text-white">Acciones de moderacion</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Estado actual: <span className="capitalize text-white">{currentStatus}</span>
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          onClick={() => submitAction("approve")}
          disabled={loadingAction !== null || currentStatus === "approved"}
        >
          {loadingAction === "approve" ? "Aprobando..." : "Aprobar"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => submitAction("pending")}
          disabled={loadingAction !== null || currentStatus === "pending"}
        >
          {loadingAction === "pending" ? "Enviando..." : "Marcar pendiente"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => submitAction("hide")}
          disabled={loadingAction !== null || currentStatus === "hidden"}
        >
          {loadingAction === "hide" ? "Ocultando..." : "Ocultar"}
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        <label className="block text-sm font-medium text-white">Motivo de rechazo</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
          placeholder="Explica al seller que debe corregir"
          rows={4}
        />
        <Button
          variant="danger"
          onClick={() => submitAction("reject")}
          disabled={loadingAction !== null || currentStatus === "rejected"}
        >
          {loadingAction === "reject" ? "Rechazando..." : "Rechazar"}
        </Button>
      </div>

      {success ? (
        <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          {success}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}
    </div>
  );
}
