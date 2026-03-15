"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CheckoutButtonProps {
  productId: string;
}

export function CheckoutButton({ productId }: CheckoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCheckout = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/checkout/${productId}`, {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setError(payload?.message || "No se pudo completar la compra");
        return;
      }

      setSuccess(payload?.message || "Compra completada");
      router.refresh();

      setTimeout(() => {
        router.push("/dashboard");
      }, 800);
    } catch {
      setError("No se pudo completar la compra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button onClick={handleCheckout} disabled={loading}>
        {loading ? "Procesando..." : "Comprar ahora"}
      </Button>
      {success ? (
        <p className="text-sm text-emerald-300">{success}</p>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
