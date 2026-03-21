import type { Metadata } from "next";

const DEFAULT_SITE_NAME = "ForjaDev Marketplace";
const DEFAULT_DESCRIPTION =
  "Marketplace premium de plugins, mapas y herramientas para ecosistemas de juegos y servidores.";

function normalizeDescription(description?: string | null) {
  if (!description) {
    return DEFAULT_DESCRIPTION;
  }

  const compact = description.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

export function getMarketplaceMetadataBase() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.RAILWAY_PUBLIC_DOMAIN;

  if (configuredUrl) {
    const normalized = configuredUrl.startsWith("http")
      ? configuredUrl
      : `https://${configuredUrl}`;
    return new URL(normalized);
  }

  return new URL("http://localhost:3000");
}

export function buildPublicMetadata({
  title,
  description,
  path,
  index = true,
  type = "website",
}: {
  title: string;
  description?: string | null;
  path: string;
  index?: boolean;
  type?: "website" | "article";
}): Metadata {
  const normalizedDescription = normalizeDescription(description);

  return {
    title,
    description: normalizedDescription,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type,
      title,
      description: normalizedDescription,
      siteName: DEFAULT_SITE_NAME,
      url: path,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: normalizedDescription,
    },
    robots: index
      ? {
          index: true,
          follow: true,
        }
      : {
          index: false,
          follow: true,
          nocache: true,
          googleBot: {
            index: false,
            follow: true,
            noimageindex: true,
          },
        },
  };
}

export function buildCatalogListingMetadata({
  searchQuery,
  pricing,
  sort,
  gameName,
  categoryName,
}: {
  searchQuery: string;
  pricing: string;
  sort: string;
  gameName?: string | null;
  categoryName?: string | null;
}): Metadata {
  const hasQueryState =
    Boolean(searchQuery) ||
    pricing !== "all" ||
    sort !== "newest" ||
    Boolean(gameName) ||
    Boolean(categoryName);

  const title = gameName
    ? `Productos para ${gameName} | ForjaDev Marketplace`
    : categoryName
      ? `${categoryName} | Catalogo de productos en ForjaDev`
      : "Catalogo de productos | ForjaDev Marketplace";

  const description = hasQueryState
    ? `Explora resultados filtrados del marketplace${gameName ? ` para ${gameName}` : ""}${categoryName ? ` en ${categoryName}` : ""}. Esta vista sirve para discovery, pero la indexacion canonica se concentra en catalogo, categorias y juegos.`
    : "Explora el catalogo de ForjaDev por productos aprobados, comparables y listos para compra, descarga y operacion segura.";

  return buildPublicMetadata({
    title,
    description,
    path: "/products",
    index: !hasQueryState,
  });
}

export function buildBundleListingMetadata(): Metadata {
  return buildPublicMetadata({
    title: "Bundles de productos | ForjaDev Marketplace",
    description:
      "Explora bundles activos con varios productos aprobados, ahorro visible y continuidad clara hacia detalle, checkout y biblioteca.",
    path: "/bundles",
    index: true,
  });
}

export function buildDealsListingMetadata(): Metadata {
  return buildPublicMetadata({
    title: "Campanas y deals activos | ForjaDev Marketplace",
    description:
      "Explora placements premium, flash deals y launch discounts conectados con productos y bundles reales del marketplace.",
    path: "/deals",
    index: true,
  });
}

export function buildBundleDetailMetadata({
  title,
  description,
  slug,
}: {
  title: string;
  description?: string | null;
  slug: string;
}): Metadata {
  return buildPublicMetadata({
    title: `${title} | Bundle en ForjaDev Marketplace`,
    description:
      description ||
      "Bundle comercial con varios productos aprobados, valor agrupado y continuidad directa a compra y postcompra.",
    path: `/bundles/${slug}`,
    index: true,
  });
}
