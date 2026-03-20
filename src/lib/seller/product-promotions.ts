type DiscountType = "percent" | "fixed";
type CampaignType = "flash_deal" | "launch_discount" | "featured_placement";

export interface PromotionValidationInput {
  title?: string;
  code?: string;
  campaignType?: CampaignType;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  maxRedemptions?: number | null;
}

function normalizeIsoDateTime(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? new Date(normalized).toISOString() : null;
}

export function normalizeCouponCode(value: string) {
  return value.trim().toUpperCase();
}

export function validatePromotionWindow(startsAt: string | null, endsAt: string | null) {
  if (startsAt && Number.isNaN(Date.parse(startsAt))) {
    throw new Error("La fecha de inicio no es valida.");
  }

  if (endsAt && Number.isNaN(Date.parse(endsAt))) {
    throw new Error("La fecha de fin no es valida.");
  }

  if (startsAt && endsAt && new Date(startsAt).getTime() > new Date(endsAt).getTime()) {
    throw new Error("La fecha de inicio no puede ir despues de la fecha de fin.");
  }
}

export function buildCampaignPayload(input: PromotionValidationInput) {
  const title = input.title?.trim() || "";
  const campaignType = input.campaignType;
  const startsAt = normalizeIsoDateTime(input.startsAt);
  const endsAt = normalizeIsoDateTime(input.endsAt);

  if (!title) {
    throw new Error("Debes indicar un titulo para la campana.");
  }

  if (!campaignType) {
    throw new Error("Debes indicar el tipo de campana.");
  }

  validatePromotionWindow(startsAt, endsAt);

  if (campaignType === "featured_placement") {
    return {
      title,
      campaign_type: campaignType,
      discount_type: null,
      discount_value: null,
      starts_at: startsAt,
      ends_at: endsAt,
    };
  }

  const discountType = input.discountType;
  const discountValue = input.discountValue;

  if (!discountType) {
    throw new Error("Debes indicar el tipo de descuento.");
  }

  if (discountValue === null || discountValue === undefined || discountValue <= 0) {
    throw new Error("Debes indicar un descuento valido.");
  }

  if (discountType === "percent" && discountValue > 100) {
    throw new Error("El descuento porcentual no puede superar el 100%.");
  }

  return {
    title,
    campaign_type: campaignType,
    discount_type: discountType,
    discount_value: discountType === "fixed" ? Math.round(discountValue * 100) : Math.round(discountValue),
    starts_at: startsAt,
    ends_at: endsAt,
  };
}

export function buildCouponPayload(input: PromotionValidationInput) {
  const code = normalizeCouponCode(input.code || "");
  const startsAt = normalizeIsoDateTime(input.startsAt);
  const endsAt = normalizeIsoDateTime(input.endsAt);
  const discountType = input.discountType;
  const discountValue = input.discountValue;
  const maxRedemptions = input.maxRedemptions ?? null;

  if (!code) {
    throw new Error("Debes indicar un codigo de cupon.");
  }

  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    throw new Error("El codigo debe tener 3-32 caracteres y usar letras, numeros, guion o guion bajo.");
  }

  validatePromotionWindow(startsAt, endsAt);

  if (!discountType) {
    throw new Error("Debes indicar el tipo de descuento.");
  }

  if (discountValue === null || discountValue === undefined || discountValue <= 0) {
    throw new Error("Debes indicar un descuento valido.");
  }

  if (discountType === "percent" && discountValue > 100) {
    throw new Error("El descuento porcentual no puede superar el 100%.");
  }

  if (maxRedemptions !== null && maxRedemptions <= 0) {
    throw new Error("El maximo de usos debe ser mayor que cero.");
  }

  return {
    code,
    discount_type: discountType,
    discount_value: discountType === "fixed" ? Math.round(discountValue * 100) : Math.round(discountValue),
    starts_at: startsAt,
    ends_at: endsAt,
    max_redemptions: maxRedemptions,
  };
}
