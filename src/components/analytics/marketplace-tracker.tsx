"use client";

import { useEffect } from "react";
import { trackMarketplaceEvent } from "@/lib/analytics/marketplace";

interface MarketplaceTrackerProps {
  eventName: string;
  pageType: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function MarketplaceTracker({
  eventName,
  pageType,
  entityType = null,
  entityId = null,
  metadata = null,
}: MarketplaceTrackerProps) {
  useEffect(() => {
    trackMarketplaceEvent({
      eventName,
      pageType,
      entityType,
      entityId,
      metadata,
    });
  }, [entityId, entityType, eventName, metadata, pageType]);

  return null;
}
