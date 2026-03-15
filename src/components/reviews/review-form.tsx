"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ReviewFormProps {
  productId: string;
}

export function ReviewForm({ productId }: ReviewFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/reviews/${productId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating,
          title,
          body,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo guardar la valoracion");
      }

      setSuccess("Valoracion enviada correctamente");
      setTitle("");
      setBody("");
      setRating(5);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la valoracion"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Deja tu valoracion</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Comparte tu experiencia para ayudar a otros compradores.
          </p>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                rating === value
                  ? "bg-[var(--primary)] text-white"
                  : "border border-white/10 bg-white/5 text-[var(--text-soft)] hover:text-white"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

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
            placeholder="Resumen rapido de tu opinion"
            maxLength={120}
            disabled={submitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white">Resena</label>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
            placeholder="Que te gusto, que mejorarias y para quien lo recomiendas"
            rows={4}
            disabled={submitting}
          />
        </div>
      </div>

      <div className="mt-5">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Enviando..." : "Enviar valoracion"}
        </Button>
      </div>
    </form>
  );
}
