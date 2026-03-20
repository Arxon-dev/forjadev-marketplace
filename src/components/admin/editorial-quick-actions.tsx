"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface EditorialQuickActionsProps {
  entity: "categories" | "articles" | "policies";
  entityId: string;
  currentStatus?: "draft" | "published" | "archived";
}

export function EditorialQuickActions({
  entity,
  entityId,
  currentStatus = "draft",
}: EditorialQuickActionsProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState("");

  const updateStatus = async (status: "draft" | "published" | "archived") => {
    setLoadingAction(status);
    setError("");

    try {
      const response = await fetch(`/api/admin/editorial/${entity}/${entityId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "No se pudo actualizar el estado editorial.");
      }

      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "No se pudo actualizar el estado editorial."
      );
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={currentStatus === "published" ? "secondary" : "primary"}
          disabled={loadingAction !== null || currentStatus === "published"}
          onClick={() => updateStatus("published")}
        >
          {loadingAction === "published" ? "Publicando..." : "Publicar"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={loadingAction !== null || currentStatus === "draft"}
          onClick={() => updateStatus("draft")}
        >
          {loadingAction === "draft" ? "Guardando..." : "Pasar a draft"}
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={loadingAction !== null || currentStatus === "archived"}
          onClick={() => updateStatus("archived")}
        >
          {loadingAction === "archived" ? "Archivando..." : "Archivar"}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
