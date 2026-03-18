"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface SupportMessageFormProps {
  ticketId: string;
  disabled?: boolean;
}

export function SupportMessageForm({ ticketId, disabled = false }: SupportMessageFormProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (disabled) {
      setError("Este ticket esta cerrado. Reabrelo antes de responder.");
      return;
    }

    if (!body.trim()) {
      setError("Debes escribir un mensaje.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      const data = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(data?.message || "No se pudo enviar el mensaje");
      }

      setBody("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold text-white">Responder</h2>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
        placeholder="Escribe una respuesta util y accionable."
        rows={5}
        disabled={loading || disabled}
      />

      <Button type="submit" className="mt-4" disabled={loading || disabled}>
        {loading ? "Enviando..." : "Enviar respuesta"}
      </Button>
      {disabled ? (
        <p className="mt-3 text-sm text-[var(--text-soft)]">
          El ticket esta cerrado. Puedes reabrirlo desde el panel lateral.
        </p>
      ) : null}
    </form>
  );
}
