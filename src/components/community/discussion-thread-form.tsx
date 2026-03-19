"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface DiscussionThreadFormProps {
  productId: string;
}

export function DiscussionThreadForm({ productId }: DiscussionThreadFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("Debes escribir un titulo.");
      return;
    }

    if (!body.trim()) {
      setError("Debes escribir un mensaje inicial.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/discussions/products/${productId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          body,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo crear la discusion");
      }

      setSuccess("Discusion creada correctamente");
      setTitle("");
      setBody("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear la discusion"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold text-white">Abrir discusion</h2>
      <p className="mt-2 text-sm text-[var(--text-soft)]">
        Comparte dudas, contexto de uso o feedback util para otros compradores.
      </p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-white">Titulo</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="Por ejemplo: Compatibilidad con Oxide actual"
            maxLength={140}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white">Mensaje inicial</label>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="Describe tu caso o pregunta de forma concreta."
            rows={5}
            disabled={submitting}
          />
        </div>
      </div>

      <div className="mt-5">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Publicando..." : "Crear discusion"}
        </Button>
      </div>
    </form>
  );
}
