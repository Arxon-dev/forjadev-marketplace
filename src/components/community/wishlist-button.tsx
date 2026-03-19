"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackMarketplaceEvent } from "@/lib/analytics/marketplace";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface WishlistButtonProps {
  productId: string;
  initialWishlisted: boolean;
  initialCount?: number;
  pageType: string;
}

export function WishlistButton({
  productId,
  initialWishlisted,
  initialCount = 0,
  pageType,
}: WishlistButtonProps) {
  const router = useRouter();
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleToggle = async () => {
    setError("");
    setBusy(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      setBusy(false);
      return;
    }

    const nextWishlisted = !wishlisted;
    setWishlisted(nextWishlisted);
    setCount((current) => Math.max(0, current + (nextWishlisted ? 1 : -1)));

    try {
      if (nextWishlisted) {
        const { error: insertError } = await supabase.from("wishlists").insert({
          user_id: user.id,
          product_id: productId,
        });

        if (insertError) {
          throw insertError;
        }
      } else {
        const { error: deleteError } = await supabase
          .from("wishlists")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);

        if (deleteError) {
          throw deleteError;
        }
      }

      trackMarketplaceEvent({
        eventName: "wishlist.toggled",
        pageType,
        entityType: "product",
        entityId: productId,
        metadata: {
          action: nextWishlisted ? "added" : "removed",
          count: Math.max(0, count + (nextWishlisted ? 1 : -1)),
        },
      });
    } catch (toggleError) {
      setWishlisted(!nextWishlisted);
      setCount((current) => Math.max(0, current + (nextWishlisted ? -1 : 1)));
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No se pudo actualizar la wishlist"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant={wishlisted ? "secondary" : "ghost"} disabled={busy} onClick={handleToggle}>
        {busy
          ? "Actualizando..."
          : wishlisted
            ? `En wishlist${count > 0 ? ` (${count})` : ""}`
            : `Guardar${count > 0 ? ` (${count})` : ""}`}
      </Button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
