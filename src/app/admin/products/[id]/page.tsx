import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModerationActions } from "@/components/admin/moderation-actions";
import { ModerationStatusPill } from "@/components/admin/moderation-status-pill";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminProductReviewPage({ params }: Props) {
  const { id } = await params;
  const { supabase } = await requireAdminContext();

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, vendor_id, title, slug, short_description, description, price_cents, is_free, moderation_status, featured_image_url, created_at, rejection_reason"
    )
    .eq("id", id)
    .single();

  if (!product) {
    notFound();
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("store_name, bio")
    .eq("id", product.vendor_id)
    .single();

  const { data: versions } = await supabase
    .from("product_versions")
    .select("id, version, changelog, created_at")
    .eq("product_id", product.id)
    .order("created_at", { ascending: false });

  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("action, metadata, created_at")
    .eq("entity_id", product.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <main>
      <SiteHeader />
      <section className="container-shell py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
              Moderacion
            </p>
            <h1 className="mt-3 text-4xl font-bold text-white">{product.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[var(--text-soft)]">
              <span>Seller: {vendor?.store_name || "Tienda"}</span>
              <ModerationStatusPill status={product.moderation_status} />
            </div>
          </div>
          <Link href="/admin">
            <Button variant="secondary">Volver a la cola</Button>
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            {product.featured_image_url ? (
              <Image
                src={product.featured_image_url}
                alt={product.title}
                width={1400}
                height={700}
                loading="eager"
                className="w-full rounded-3xl object-cover"
              />
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Resumen</h2>
              <p className="mt-3 text-[var(--text-soft)]">
                {product.short_description || "Sin descripcion corta."}
              </p>
              <p className="mt-4 whitespace-pre-wrap text-[var(--text-soft)]">
                {product.description || "Sin descripcion extendida."}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Versiones</h2>
              {versions && versions.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {versions.map((version) => (
                    <div key={version.id} className="rounded-xl border border-white/10 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-medium text-white">{version.version}</p>
                        <p className="text-xs text-[var(--text-soft)]">
                          {new Date(version.created_at).toLocaleString("es-ES")}
                        </p>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text-soft)]">
                        {version.changelog || "Sin changelog."}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[var(--text-soft)]">No hay versiones registradas.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Detalles</h2>
              <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
                <p>
                  Precio:{" "}
                  <span className="text-white">
                    {product.is_free ? "Gratis" : `€${(product.price_cents / 100).toFixed(2)}`}
                  </span>
                </p>
                <p>
                  Slug: <span className="text-white">{product.slug}</span>
                </p>
                <p>
                  Creado:{" "}
                  <span className="text-white">
                    {new Date(product.created_at).toLocaleString("es-ES")}
                  </span>
                </p>
                {product.rejection_reason ? (
                  <p>
                    Ultimo motivo de rechazo:{" "}
                    <span className="text-amber-300">{product.rejection_reason}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Actividad reciente</h2>
              {auditLogs && auditLogs.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {auditLogs.map((log, index) => (
                    <div key={`${log.action}-${index}`} className="rounded-xl border border-white/10 p-4">
                      <p className="font-medium text-white">{log.action}</p>
                      <p className="mt-1 text-xs text-[var(--text-soft)]">
                        {new Date(log.created_at).toLocaleString("es-ES")}
                      </p>
                      <p className="mt-2 break-words text-sm text-[var(--text-soft)]">
                        {log.metadata ? JSON.stringify(log.metadata) : "Sin metadata"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[var(--text-soft)]">Aun no hay acciones registradas.</p>
              )}
            </div>

            <ModerationActions
              productId={product.id}
              currentStatus={product.moderation_status}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
