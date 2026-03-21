type SignalTone = "primary" | "success" | "warning";

export interface ShoppingQualitySignal {
  label: string;
  detail: string;
  tone: SignalTone;
}

export interface ShoppingQualitySnapshot {
  headline: string;
  summary: string;
  signals: ShoppingQualitySignal[];
}

export interface ShoppingQualityInput {
  ratingAverage?: number | null;
  ratingCount?: number;
  supportPolicy?: string | null;
  refundPolicy?: string | null;
  updatePolicy?: string | null;
  lastUpdatedAt?: string | null;
  sellerApprovedProducts?: number | null;
  sellerTotalPurchases?: number | null;
  sellerIdentityVerified?: boolean;
}

const RECENT_ACTIVITY_WINDOW_MS = 1000 * 60 * 60 * 24 * 45;

function hasRecentActivity(dateString?: string | null) {
  if (!dateString) {
    return false;
  }

  return Date.now() - new Date(dateString).getTime() <= RECENT_ACTIVITY_WINDOW_MS;
}

export function buildShoppingQualitySnapshot(
  input: ShoppingQualityInput
): ShoppingQualitySnapshot | null {
  const signals: ShoppingQualitySignal[] = [];

  if ((input.ratingCount || 0) >= 5 && (input.ratingAverage || 0) >= 4.5) {
    signals.push({
      label: "Muy bien valorado",
      detail: `${input.ratingAverage?.toFixed(1) || "0.0"}/5 en ${input.ratingCount} resenas reales.`,
      tone: "success",
    });
  } else if ((input.ratingCount || 0) >= 3 && (input.ratingAverage || 0) >= 4) {
    signals.push({
      label: "Feedback positivo",
      detail: `${input.ratingAverage?.toFixed(1) || "0.0"}/5 con un volumen ya util de resenas.`,
      tone: "primary",
    });
  }

  if (input.sellerIdentityVerified) {
    signals.push({
      label: "Identidad verificada",
      detail: "El seller tiene identidad conectada y visible en el marketplace.",
      tone: "primary",
    });
  } else if ((input.sellerApprovedProducts || 0) >= 3 || (input.sellerTotalPurchases || 0) >= 25) {
    signals.push({
      label: "Seller consolidado",
      detail: `Catalogo aprobado: ${input.sellerApprovedProducts || 0} producto(s) con actividad real.`,
      tone: "primary",
    });
  }

  if (input.supportPolicy && input.refundPolicy) {
    signals.push({
      label: "Soporte y reembolsos claros",
      detail: "El producto declara soporte y politica de reembolso dentro de la ficha.",
      tone: "warning",
    });
  } else if (input.supportPolicy || input.updatePolicy || input.refundPolicy) {
    signals.push({
      label: "Politicas visibles",
      detail: "La ficha ya explica parte del soporte, mantenimiento o reembolsos.",
      tone: "warning",
    });
  }

  if (hasRecentActivity(input.lastUpdatedAt)) {
    signals.push({
      label: "Mantenimiento reciente",
      detail: "El producto o su catalogo asociado tuvo actividad reciente.",
      tone: "success",
    });
  }

  const selectedSignals = signals.slice(0, 4);

  if (selectedSignals.length === 0) {
    return null;
  }

  return {
    headline: "Compra con contexto",
    summary: "Estas senales ayudan a reducir incertidumbre antes de comprar.",
    signals: selectedSignals,
  };
}
