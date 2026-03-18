import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { createClient } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "*, items:order_items(*, product:products(id, title, slug), license:licenses(id, license_key, status, issued_at))"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Pedidos</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Historial de pedidos</h1>
        <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
          Revisa tus compras, tus licencias y vuelve a cada producto desde un historial dedicado.
        </p>

        {orders && orders.length > 0 ? (
          <div className="mt-10 space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Pedido #{order.id.slice(0, 8)}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      {new Date(order.created_at).toLocaleString("es-ES")} ·{" "}
                      <span className="capitalize">{order.status}</span>
                    </p>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {order.total_cents === 0
                      ? "Gratis"
                      : `EUR ${(order.total_cents / 100).toFixed(2)}`}
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {(order.items || []).map((item: any) => {
                    const license = Array.isArray(item.license) ? item.license[0] : item.license;

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/10 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-[var(--text-soft)]">{item.product?.title}</span>
                          <div className="flex flex-wrap gap-3">
                            {item.product?.slug ? (
                              <Link
                                href={`/products/${item.product.slug}`}
                                className="text-sm font-medium text-white hover:underline"
                              >
                                Ver producto
                              </Link>
                            ) : null}
                            {item.product?.id ? (
                              <Link
                                href={`/support?product=${item.product.id}`}
                                className="text-sm font-medium text-[var(--primary)] hover:underline"
                              >
                                Abrir soporte
                              </Link>
                            ) : null}
                          </div>
                        </div>

                        {license ? (
                          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">
                              Licencia
                            </p>
                            <p className="mt-2 font-mono text-sm text-white">{license.license_key}</p>
                            <p className="mt-1 text-xs text-emerald-200">
                              Estado: {license.status} · Emitida el{" "}
                              {new Date(license.issued_at).toLocaleDateString("es-ES")}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs text-[var(--text-soft)]">
                            Esta compra no tiene licencia asociada.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">Aun no tienes pedidos en tu cuenta.</p>
          </div>
        )}
      </section>
    </main>
  );
}
