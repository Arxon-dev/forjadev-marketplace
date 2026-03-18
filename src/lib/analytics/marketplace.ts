"use client";

type MarketplaceEventInput = {
  eventName: string;
  pageType: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

const SESSION_STORAGE_KEY = "fj_marketplace_session_id";

function getMarketplaceSessionId() {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const nextId = crypto.randomUUID();
  window.localStorage.setItem(SESSION_STORAGE_KEY, nextId);
  return nextId;
}

export function trackMarketplaceEvent({
  eventName,
  pageType,
  entityType = null,
  entityId = null,
  metadata = null,
}: MarketplaceEventInput) {
  try {
    const payload = JSON.stringify({
      sessionId: getMarketplaceSessionId(),
      eventName,
      pageType,
      entityType,
      entityId,
      metadata,
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/marketplace", blob);
      return;
    }

    void fetch("/api/analytics/marketplace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Discovery analytics must never break the UX.
  }
}
