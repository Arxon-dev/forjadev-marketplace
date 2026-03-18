"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ProductOption {
  id: string;
  title: string;
}

interface SupportTicketFormProps {
  products: ProductOption[];
  initialProductId?: string | null;
}

export function SupportTicketForm({ products, initialProductId = null }: SupportTicketFormProps) {
  const router = useRouter();
  const [productId, setProductId] = useState(
    initialProductId && products.some((product) => product.id === initialProductId)
      ? initialProductId
      : products[0]?.id || ""
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "high">("normal");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!productId || !subject.trim() || !message.trim()) {
      setError("Debes completar producto, asunto y mensaje.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          subject,
          message,
          priority,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string; ticketId?: string }
        | null;

      if (!response.ok || !data?.ticketId) {
        throw new Error(data?.message || "No se pudo crear el ticket");
      }

      router.push(`/support/tickets/${data.ticketId}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo crear el ticket");
      setLoading(false);
    }
  };

  if (products.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold text-white">Abrir ticket</h2>
        <p className="mt-3 text-[var(--text-soft)]">
          Necesitas haber descargado o comprado un producto para abrir soporte.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold text-white">Abrir ticket</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Crea una conversacion directa con el seller sobre un producto de tu biblioteca.
      </p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-white">Producto</label>
          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
            disabled={loading}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white">Asunto</label>
          <input
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="Describe el problema o la duda principal"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white">Prioridad</label>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value === "high" ? "high" : "normal")}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-white/30 focus:outline-none"
            disabled={loading}
          >
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white">Mensaje</label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="Explica contexto, pasos realizados y resultado esperado."
            rows={5}
            disabled={loading}
          />
        </div>
      </div>

      <Button type="submit" className="mt-5 w-full" disabled={loading}>
        {loading ? "Creando ticket..." : "Crear ticket"}
      </Button>
    </form>
  );
}
