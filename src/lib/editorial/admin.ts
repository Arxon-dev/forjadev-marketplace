export type EditorialStatus = "draft" | "published" | "archived";
export type EditorialAudience = "buyer" | "seller" | "shared";
export type HelpArticleType = "guide" | "policy" | "faq" | "troubleshooting" | "post_sale";

export function slugifyEditorialValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidEditorialSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function normalizeEditorialStatus(value: string | undefined): EditorialStatus {
  if (value === "published" || value === "archived") {
    return value;
  }

  return "draft";
}

export function normalizeEditorialAudience(value: string | undefined): EditorialAudience {
  if (value === "buyer" || value === "seller") {
    return value;
  }

  return "shared";
}

export function normalizeHelpArticleType(value: string | undefined): HelpArticleType {
  if (
    value === "guide" ||
    value === "policy" ||
    value === "faq" ||
    value === "troubleshooting" ||
    value === "post_sale"
  ) {
    return value;
  }

  return "guide";
}

export function validateCategoryInput(input: {
  title: string;
  slug: string;
}) {
  if (!input.title.trim()) {
    return "El titulo es obligatorio.";
  }

  if (!input.slug.trim()) {
    return "El slug es obligatorio.";
  }

  if (!isValidEditorialSlug(input.slug)) {
    return "El slug solo puede contener minusculas, numeros y guiones.";
  }

  return null;
}

export function validateHelpArticleInput(input: {
  title: string;
  slug: string;
  summary: string;
  body: string;
  categoryId: string;
  status: EditorialStatus;
}) {
  if (!input.title.trim()) {
    return "El titulo es obligatorio.";
  }

  if (!input.slug.trim()) {
    return "El slug es obligatorio.";
  }

  if (!isValidEditorialSlug(input.slug)) {
    return "El slug solo puede contener minusculas, numeros y guiones.";
  }

  if (!input.categoryId) {
    return "Debes seleccionar una categoria.";
  }

  if (input.status === "published") {
    if (!input.summary.trim()) {
      return "No puedes publicar un articulo sin resumen.";
    }

    if (!input.body.trim()) {
      return "No puedes publicar un articulo sin contenido.";
    }
  }

  if (!input.body.trim() && input.status !== "archived") {
    return "El contenido es obligatorio para guardar el articulo.";
  }

  return null;
}

export function validatePolicyInput(input: {
  title: string;
  policyKey: string;
  summary: string;
  body: string;
  status: EditorialStatus;
}) {
  if (!input.title.trim()) {
    return "El titulo es obligatorio.";
  }

  if (!input.policyKey.trim()) {
    return "La clave publica es obligatoria.";
  }

  if (!isValidEditorialSlug(input.policyKey)) {
    return "La clave publica solo puede contener minusculas, numeros y guiones.";
  }

  if (input.status === "published") {
    if (!input.summary.trim()) {
      return "No puedes publicar una policy sin resumen.";
    }

    if (!input.body.trim()) {
      return "No puedes publicar una policy sin contenido.";
    }
  }

  if (!input.body.trim() && input.status !== "archived") {
    return "El contenido es obligatorio para guardar la policy.";
  }

  return null;
}
