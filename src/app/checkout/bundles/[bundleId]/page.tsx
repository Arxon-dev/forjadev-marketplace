import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckoutButton } from "@/components/checkout/checkout-button";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ bundleId: string }>;
}

interface BundleCheckoutProduct {
  id: string;
  title: string;
  price_cents: number;
  moderation_status: string;
}

interface BundleCheckoutProductRow {
  product: BundleCheckoutProduct[];
}

export default async function BundleCheckoutPage({ params }: Props) {
  const { bundleId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: bundle } = await supabase
    .from("bundles")
    .select("id, title, slug, short_description, price_cents, is_active")
    .eq("id", bundleId)
    .single();

  if (!bundle) {
    notFound();
  }

  const { data: bundleProducts } = await supabase
    .from("bundle_products")
    .select("product:products!inner(id, title, price_cents, moderation_status)")
    .eq("bundle_id", bundle.id);

  const includedProducts = ((bundleProducts || []) as BundleCheckoutProductRow[])
    .map((item) => item.product[0])
    .filter(Boolean)
    .filter((product) => product.moderation_status === "approved");

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Checkout bundle</p>
        <h1 className="mt-3 text-4xl font-bold text-white">{bundle.title}</h1>
        <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
          {bundle.short_description || "Confirma la compra del bundle para anadir todos sus productos a tu biblioteca."}
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Resumen del bundle</h2>
            <div className="mt-5 space-y-3 text-[var(--text-soft)]">
              <p>
                Productos incluidos: <span className="text-white">{includedProducts.length}</span>
              </p>
              <p>
                Precio bundle: <span className="text-white">EUR {(bundle.price_cents / 100).toFixed(2)}</span>
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {includedProducts.map((product) => (
                <div key={product.id} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <p className="font-medium text-white">{product.title}</p>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    Valor individual EUR {(product.price_cents / 100).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Confirmacion</h2>
            <div className="mt-4 space-y-4">
              <p className="text-[var(--text-soft)]">
                Esta compra crea una unica orden con varios productos y emite las licencias necesarias.
              </p>
              <CheckoutButton
                productId={bundle.id}
                productPriceCents={bundle.price_cents}
                endpointPath={`/api/checkout/bundles/${bundle.id}`}
                submitLabel="Comprar bundle"
                allowCoupons={false}
              />
              <Link
                href={`/bundles/${bundle.slug}`}
                className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Volver al bundle
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
