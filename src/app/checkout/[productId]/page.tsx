import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckoutButton } from "@/components/checkout/checkout-button";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ productId: string }>;
  searchParams?: Promise<{ coupon?: string }>;
}

export default async function CheckoutPage({ params, searchParams }: Props) {
  const { productId } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, title, slug, short_description, price_cents, currency, is_free, moderation_status")
    .eq("id", productId)
    .single();

  if (!product) {
    notFound();
  }

  const { data: existingPurchase } = await supabase
    .from("order_items")
    .select("id, order:orders!inner(status, user_id)")
    .eq("product_id", productId)
    .eq("order.user_id", user.id)
    .eq("order.status", "completed")
    .limit(1)
    .maybeSingle();

  const { data: licenses } = existingPurchase
    ? await supabase
        .from("licenses")
        .select("id, status")
        .eq("product_id", productId)
        .eq("user_id", user.id)
    : { data: [] as { id: string; status: "active" | "revoked" }[] };

  const hasAnyLicense = Boolean(licenses && licenses.length > 0);
  const hasActiveLicense = Boolean(
    licenses && licenses.some((license) => license.status === "active")
  );
  const hasRevokedLicense = hasAnyLicense && !hasActiveLicense;

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
          Checkout
        </p>
        <h1 className="mt-3 text-4xl font-bold text-white">{product.title}</h1>
        <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
          {product.short_description || "Confirma tu compra para anadir este producto a tu biblioteca."}
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Resumen del pedido</h2>
            <div className="mt-5 space-y-3 text-[var(--text-soft)]">
              <p>
                Producto: <span className="text-white">{product.title}</span>
              </p>
              <p>
                Estado: <span className="capitalize text-white">{product.moderation_status}</span>
              </p>
              <p>
                Precio:{" "}
                <span className="text-white">
                  {product.is_free ? "Gratis" : `EUR ${(product.price_cents / 100).toFixed(2)}`}
                </span>
              </p>
              {resolvedSearchParams.coupon ? (
                <p>
                  Cupon sugerido:{" "}
                  <span className="text-white">{resolvedSearchParams.coupon.toUpperCase()}</span>
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Confirmacion</h2>
            {existingPurchase && hasRevokedLicense ? (
              <div className="mt-4 space-y-4">
                <p className="text-amber-300">
                  Esta compra existe, pero la licencia asociada esta revocada. La descarga esta bloqueada hasta que un administrador la reactive.
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/licenses"
                    className="inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                  >
                    Ver licencias
                  </Link>
                  <Link
                    href={`/products/${product.slug}`}
                    className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Volver al producto
                  </Link>
                </div>
              </div>
            ) : existingPurchase ? (
              <div className="mt-4 space-y-4">
                <p className="text-[var(--text-soft)]">
                  Ya compraste este producto. Puedes volver a tu biblioteca o ir a la ficha.
                </p>
                <div className="flex gap-3">
                  <Link
                    href="/dashboard"
                    className="inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                  >
                    Ir al dashboard
                  </Link>
                  <Link
                    href={`/products/${product.slug}`}
                    className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Ver producto
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-[var(--text-soft)]">
                  Esta version del checkout crea una orden completada en tu biblioteca y desbloquea la descarga.
                </p>
                <CheckoutButton
                  productId={product.id}
                  productPriceCents={product.price_cents}
                  currency={product.currency || "EUR"}
                  initialCouponCode={resolvedSearchParams.coupon || ""}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
