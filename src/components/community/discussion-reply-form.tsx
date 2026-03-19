"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface DiscussionReplyFormProps {
  discussionId: string;
  disabled?: boolean;
}

export function DiscussionReplyForm({
  discussionId,
  disabled = false,
}: DiscussionReplyFormProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (disabled) {
      setError("Esta discusion esta bloqueada.");
      return;
    }

    if (!body.trim()) {
      setError("Debes escribir una respuesta.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/discussions/${discussionId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo enviar la respuesta");
      }

      setBody("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo enviar la respuesta"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold text-white">Responder en la discusion</h2>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
        placeholder="Aporta contexto util, pasos o una respuesta clara."
        rows={5}
        disabled={submitting || disabled}
      />

      <Button type="submit" className="mt-4" disabled={submitting || disabled}>
        {submitting ? "Enviando..." : "Publicar respuesta"}
      </Button>
    </form>
  );
}
