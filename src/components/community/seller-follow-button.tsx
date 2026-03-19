"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackMarketplaceEvent } from "@/lib/analytics/marketplace";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface SellerFollowButtonProps {
  vendorId: string;
  initialFollowing: boolean;
  initialFollowerCount?: number;
  pageType: string;
}

export function SellerFollowButton({
  vendorId,
  initialFollowing,
  initialFollowerCount = 0,
  pageType,
}: SellerFollowButtonProps) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialFollowerCount);
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

    const nextFollowing = !following;
    setFollowing(nextFollowing);
    setCount((current) => Math.max(0, current + (nextFollowing ? 1 : -1)));

    try {
      if (nextFollowing) {
        const { error: insertError } = await supabase.from("seller_followers").insert({
          user_id: user.id,
          vendor_id: vendorId,
        });

        if (insertError) {
          throw insertError;
        }
      } else {
        const { error: deleteError } = await supabase
          .from("seller_followers")
          .delete()
          .eq("user_id", user.id)
          .eq("vendor_id", vendorId);

        if (deleteError) {
          throw deleteError;
        }
      }

      trackMarketplaceEvent({
        eventName: "seller.follow.toggled",
        pageType,
        entityType: "seller",
        entityId: vendorId,
        metadata: {
          action: nextFollowing ? "followed" : "unfollowed",
          count: Math.max(0, count + (nextFollowing ? 1 : -1)),
        },
      });
    } catch (toggleError) {
      setFollowing(!nextFollowing);
      setCount((current) => Math.max(0, current + (nextFollowing ? -1 : 1)));
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "No se pudo actualizar el seguimiento"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button type="button" variant={following ? "secondary" : "primary"} disabled={busy} onClick={handleToggle}>
        {busy
          ? "Actualizando..."
          : following
            ? `Siguiendo${count > 0 ? ` (${count})` : ""}`
            : `Seguir${count > 0 ? ` (${count})` : ""}`}
      </Button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
