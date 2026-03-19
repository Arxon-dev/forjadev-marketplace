import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckoutButton } from "@/components/checkout/checkout-button";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Badge } from "@/components/ui/badge";
import { getPublicDealsForBundles } from "@/lib/promotions/public";
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
  product: BundleProductItem[];
}

export default async function BundleDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bundle } = await supabase
    .from("bundles")
    .select("id, vendor_id, title, slug, short_description, description, featured_image_url, price_cents, is_active, created_at")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!bundle) {
    notFound();
  }

  const [{ data: vendor }, { data: bundleProducts }] = await Promise.all([
    supabase.from("vendors").select("id, store_name, slug").eq("id", bundle.vendor_id).single(),
    supabase
      .from("bundle_products")
      .select(
        "sort_order, product:products!inner(id, title, slug, short_description, price_cents, featured_image_url, compatibility, moderation_status)"
      )
      .eq("bundle_id", bundle.id)
      .order("sort_order", { ascending: true }),
  ]);

  const includedProducts = ((bundleProducts || []) as BundleProductRow[])
    .map((item) => item.product[0])
    .filter(Boolean)
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
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
          <Link href="/products" className="hover:text-white">
            Productos
          </Link>
          <span>/</span>
          <span className="text-white">Bundle</span>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Bundle</p>
            <h1 className="mt-3 text-4xl font-bold text-white">{bundle.title}</h1>
            <p className="mt-3 text-sm text-[var(--text-soft)]">
              Por {vendor?.store_name || "Tienda"} | {includedProducts.length} productos incluidos
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
              <h2 className="text-xl font-semibold text-white">Descripcion</h2>
              <p className="mt-4 whitespace-pre-wrap text-[var(--text-soft)]">
                {bundle.description || "Este bundle no tiene descripcion detallada todavia."}
              </p>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Contenido del bundle</h2>
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
              <h2 className="text-xl font-semibold text-white">Resumen comercial</h2>
              <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
                <p>
                  Creador:{" "}
                  {vendor?.slug ? (
                    <Link href={`/seller/${vendor.slug}`} className="text-white hover:underline">
                      {vendor.store_name}
                    </Link>
                  ) : (
                    <span className="text-white">{vendor?.store_name || "Tienda"}</span>
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
