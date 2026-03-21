import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutButton } from "@/components/checkout/checkout-button";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { CommerceSectionHeading, CommerceStage } from "@/components/marketplace/commerce-surface-system";
import { Badge } from "@/components/ui/badge";
import { getPublicDealsForBundles } from "@/lib/promotions/public";
import { buildBundleDetailMetadata } from "@/lib/seo/public-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ slug: string }>;
}

interface BundleProductItem {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  price_cents: number;
  featured_image_url: string | null;
  compatibility: string | null;
  moderation_status: string;
}

interface BundleProductRow {
  sort_order: number;
  product: BundleProductItem | BundleProductItem[] | null;
}

interface BundleVendorRow {
  id: string;
  store_name: string;
  slug: string | null;
}

interface BundleMetadataRow {
  title: string;
  slug: string;
  short_description: string | null;
  is_active: boolean;
}

interface BundleDetailRow {
  id: string;
  vendor_id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  featured_image_url: string | null;
  price_cents: number;
  is_active: boolean;
  created_at: string;
}

function resolveBundleProduct(
  product: BundleProductItem | BundleProductItem[] | null
): BundleProductItem | null {
  return Array.isArray(product) ? (product[0] ?? null) : product;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const adminSupabase = createAdminClient();
  const { data: bundleData } = await adminSupabase
    .from("bundles")
    .select("title, slug, short_description, is_active")
    .eq("slug", slug)
    .maybeSingle();
  const bundle = bundleData as BundleMetadataRow | null;

  if (!bundle || !bundle.is_active) {
    return buildBundleDetailMetadata({
      title: "Bundle",
      slug,
      description: "Bundle comercial en ForjaDev Marketplace.",
    });
  }

  return buildBundleDetailMetadata({
    title: bundle.title,
    slug: bundle.slug,
    description: bundle.short_description,
  });
}

export default async function BundleDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bundleData } = await adminSupabase
    .from("bundles")
    .select("id, vendor_id, title, slug, short_description, description, featured_image_url, price_cents, is_active, created_at")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  const bundle = bundleData as BundleDetailRow | null;

  if (!bundle) {
    notFound();
  }

  const [{ data: vendor }, { data: bundleProducts }] = await Promise.all([
    adminSupabase.from("vendors").select("id, store_name, slug").eq("id", bundle.vendor_id).single(),
    adminSupabase
      .from("bundle_products")
      .select(
        "sort_order, product:products!inner(id, title, slug, short_description, price_cents, featured_image_url, compatibility, moderation_status)"
      )
      .eq("bundle_id", bundle.id)
      .order("sort_order", { ascending: true }),
  ]);
  const resolvedVendor = vendor as BundleVendorRow | null;

  const includedProducts = ((bundleProducts || []) as BundleProductRow[])
    .map((item) => resolveBundleProduct(item.product))
    .filter((product): product is BundleProductItem => Boolean(product))
    .filter((product) => product.moderation_status === "approved");

  if (includedProducts.length === 0) {
    notFound();
  }

  const originalTotalCents = includedProducts.reduce((sum, product) => sum + product.price_cents, 0);
  const savingsCents = Math.max(0, originalTotalCents - bundle.price_cents);
  const bundleDeals = await getPublicDealsForBundles([
    {
      id: bundle.id,
      price_cents: bundle.price_cents,
    },
  ]);
  const activeDeal = bundleDeals.get(bundle.id) || null;
  const checkoutPriceCents = activeDeal?.discountedPriceCents ?? bundle.price_cents;
  const totalSavingsCents = savingsCents + (activeDeal?.savingsCents ?? 0);

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <CommerceStage
          dataId="bundle-detail-stage"
          eyebrow="Bundle Detail"
          title={bundle.title}
          description={
            bundle.short_description ||
            "Compra varios productos aprobados en una sola operacion comercial con ahorro visible y continuidad real hacia checkout y biblioteca."
          }
          surface="context"
          path={
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
              <Link href="/bundles" className="hover:text-white">
                Bundles
              </Link>
              <span>/</span>
              <span className="text-white">{bundle.title}</span>
            </div>
          }
          actions={[
            { label: "Explorar bundles", href: "/bundles", variant: "secondary" },
            { label: "Ver catalogo", href: "/products", variant: "secondary" },
          ]}
          stats={[
            { label: "Productos incluidos", value: String(includedProducts.length) },
            { label: "Ahorro total", value: `EUR ${(totalSavingsCents / 100).toFixed(2)}` },
          ]}
        />

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mt-3 text-sm text-[var(--text-soft)]">
              Por {resolvedVendor?.store_name || "Tienda"} | {includedProducts.length} productos incluidos
            </p>

            {bundle.featured_image_url ? (
              <Image
                src={bundle.featured_image_url}
                alt={bundle.title}
                width={1400}
                height={700}
                className="mt-8 h-72 w-full rounded-3xl object-cover"
              />
            ) : null}

            {bundle.short_description ? (
              <p className="mt-8 text-lg text-white/85">{bundle.short_description}</p>
            ) : null}

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <CommerceSectionHeading
                eyebrow="Oferta agrupada"
                title="Descripcion"
                description="Explica por que este bundle merece la pena como bloque comercial completo y no solo como una promo aislada."
              />
              <p className="mt-4 whitespace-pre-wrap text-[var(--text-soft)]">
                {bundle.description || "Este bundle no tiene descripcion detallada todavia."}
              </p>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <CommerceSectionHeading
                eyebrow="Contenido incluido"
                title="Contenido del bundle"
                description="Cada producto mantiene continuidad hacia su propia ficha para comparar antes de comprar el pack completo."
              />
              <div className="mt-5 space-y-4">
                {includedProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 p-4"
                  >
                    <div>
                      <p className="font-semibold text-white">
                        {index + 1}. {product.title}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">
                        {product.short_description || product.compatibility || "Producto incluido en el bundle"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-white">
                        EUR {(product.price_cents / 100).toFixed(2)}
                      </p>
                      <Link href={`/products/${product.slug}`} className="text-sm text-[var(--text-soft)] hover:text-white">
                        Ver producto
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-[var(--text-soft)]">Precio bundle</p>
              <p className="mt-2 text-3xl font-bold text-white">
                EUR {(checkoutPriceCents / 100).toFixed(2)}
              </p>
              {checkoutPriceCents < originalTotalCents ? (
                <p className="mt-3 text-sm text-[var(--text-soft)] line-through">
                  EUR {(originalTotalCents / 100).toFixed(2)}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>Ahorro EUR {(totalSavingsCents / 100).toFixed(2)}</Badge>
                <Badge>{includedProducts.length} productos</Badge>
                {activeDeal ? <Badge>{activeDeal.promoLabel}</Badge> : null}
              </div>
              {activeDeal?.expiresAt ? (
                <p className="mt-3 text-sm text-[var(--text-soft)]">
                  Promo activa hasta {new Date(activeDeal.expiresAt).toLocaleDateString("es-ES")}
                </p>
              ) : null}

              <div className="mt-6 space-y-4">
                {!user ? (
                  <>
                    <p className="text-sm text-[var(--text-soft)]">
                      Necesitas iniciar sesion para comprar este bundle.
                    </p>
                    <Link
                      href="/login"
                      className="inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      Iniciar sesion
                    </Link>
                  </>
                ) : (
                  <CheckoutButton
                    productId={bundle.id}
                    productPriceCents={checkoutPriceCents}
                    endpointPath={`/api/checkout/bundles/${bundle.id}`}
                    submitLabel="Comprar bundle"
                    allowCoupons={false}
                  />
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <CommerceSectionHeading
                eyebrow="Compra con contexto"
                title="Resumen comercial"
                description="El bundle mantiene continuidad con seller, productos incluidos y valor agrupado antes de pasar al checkout."
              />
              <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
                <p>
                  Creador:{" "}
                  {resolvedVendor?.slug ? (
                    <Link href={`/seller/${resolvedVendor.slug}`} className="text-white hover:underline">
                      {resolvedVendor.store_name}
                    </Link>
                  ) : (
                    <span className="text-white">{resolvedVendor?.store_name || "Tienda"}</span>
                  )}
                </p>
                <p>
                  Productos incluidos: <span className="text-white">{includedProducts.length}</span>
                </p>
                <p>
                  Valor original: <span className="text-white">EUR {(originalTotalCents / 100).toFixed(2)}</span>
                </p>
                <p>
                  Ahorro total: <span className="text-white">EUR {(totalSavingsCents / 100).toFixed(2)}</span>
                </p>
                <p>
                  Continuidad postcompra: <span className="text-white">una orden unica y licencias por producto</span>
                </p>
                {activeDeal ? (
                  <p>
                    Promo activa: <span className="text-white">{activeDeal.promoLabel}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
