"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface DownloadButtonProps {
  productId: string;
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  redirectOnUnauthorized?: boolean;
}

export function DownloadButton({
  productId,
  label = "Descargar",
  className,
  variant = "primary",
  redirectOnUnauthorized = false,
}: DownloadButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/download/${productId}`, {
        method: "GET",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => null)) as
        | { url?: string; message?: string }
        | null;

      if (response.status === 401 && redirectOnUnauthorized) {
        router.push("/login");
        return;
      }

      if (!response.ok || !payload?.url) {
        setError(payload?.message || "No se pudo iniciar la descarga");
        return;
      }

      window.location.assign(payload.url);
    } catch {
      setError("No se pudo iniciar la descarga");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Button onClick={handleDownload} disabled={loading} variant={variant}>
        {loading ? "Preparando..." : label}
      </Button>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
