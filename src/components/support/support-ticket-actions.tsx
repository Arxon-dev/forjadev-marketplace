"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type TicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";

interface SupportTicketActionsProps {
  ticketId: string;
  status: TicketStatus;
}

export function SupportTicketActions({ ticketId, status }: SupportTicketActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const nextStatus: TicketStatus = status === "closed" ? "open" : "closed";
  const label = status === "closed" ? "Reabrir ticket" : "Cerrar ticket";

  const handleClick = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(data?.message || "No se pudo actualizar el ticket");
      }

      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el ticket");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button variant="secondary" onClick={handleClick} disabled={loading}>
        {loading ? "Actualizando..." : label}
      </Button>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
