import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type DisputeRow = {
  id: string;
  order_id: string | null;
  product_id: string | null;
  license_id: string | null;
  status: "open" | "reviewing" | "resolved" | "rejected";
  reason: string;
  created_at: string;
  updated_at: string;
};

export default async function DisputesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: disputes } = await supabase
    .from("disputes")
    .select("id, order_id, product_id, license_id, status, reason, created_at, updated_at")
    .eq("opened_by_user_id", user.id)
    .order("updated_at", { ascending: false });

  const productIds = Array.from(new Set((disputes || []).map((dispute) => dispute.product_id).filter(Boolean) as string[]));
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id, title, slug").in("id", productIds)
    : { data: [] };

  const productById = new Map((products || []).map((product) => [product.id, product]));

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Cuenta</p>
            <h1 className="mt-3 text-4xl font-bold text-white">Disputas</h1>
            <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
              Sigue el estado de tus revisiones administrativas sobre compras, licencias o entregas.
            </p>
          </div>
          <Link href="/orders">
            <Button variant="secondary">Volver a pedidos</Button>
          </Link>
        </div>

        {disputes && disputes.length > 0 ? (
          <div className="space-y-4">
            {disputes.map((dispute: DisputeRow) => {
              const product = dispute.product_id ? productById.get(dispute.product_id) : null;

              return (
                <article key={dispute.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                          {dispute.status}
                        </span>
                        {dispute.order_id ? (
                          <span className="text-xs text-[var(--text-soft)]">
                            Pedido #{dispute.order_id.slice(0, 8)}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-3 text-lg font-semibold text-white">
                        {product?.title || "Disputa de compra"}
                      </h2>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-soft)]">
                        {dispute.reason}
                      </p>
                      <p className="mt-3 text-xs text-[var(--text-soft)]">
                        Abierta: {new Date(dispute.created_at).toLocaleString("es-ES")} · Actualizada:{" "}
                        {new Date(dispute.updated_at).toLocaleString("es-ES")}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {product?.slug ? (
                        <Link href={`/products/${product.slug}`}>
                          <Button variant="secondary">Ver producto</Button>
                        </Link>
                      ) : null}
                      <Link href="/dashboard">
                        <Button variant="ghost">Notificaciones</Button>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">Todavia no has abierto disputas.</p>
          </div>
        )}
      </section>
    </main>
  );
}
