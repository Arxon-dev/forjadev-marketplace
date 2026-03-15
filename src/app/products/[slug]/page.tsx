import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadButton } from "@/components/downloads/download-button";
import { SiteHeader } from "@/components/layout/site-header";
import { ReviewForm } from "@/components/reviews/review-form";
import { createClient } from "@/lib/supabase/server";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, title, slug, short_description, description, price_cents, is_free, moderation_status, featured_image_url, vendor_id, rejection_reason, compatibility, created_at"
    )
    .eq("slug", slug)
    .single();

  if (!product) {
    notFound();
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("user_id, store_name, bio")
    .eq("id", product.vendor_id)
    .single();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const { data: versions } = await supabase
    .from("product_versions")
    .select("id, version, changelog, created_at")
    .eq("product_id", product.id)
    .order("created_at", { ascending: false });

  const versionIds = (versions || []).map((version) => version.id);
  const { data: versionFiles } =
    versionIds.length > 0
      ? await supabase
          .from("product_files")
          .select("product_version_id")
          .in("product_version_id", versionIds)
      : { data: [] as { product_version_id: string }[] };

  const downloadableVersionIds = new Set(
    (versionFiles || []).map((file) => file.product_version_id)
  );

  const latestVersion =
    versions?.find((version) => downloadableVersionIds.has(version.id)) || versions?.[0] || null;

  const isOwner = Boolean(user && vendor?.user_id === user.id);
  const isAdmin = profile?.role === "admin";

  let hasPurchase = false;
  let hasDownload = false;
  let hasActiveLicense = false;
  let hasAnyLicense = false;

  if (user && !isOwner && !isAdmin) {
    if (product.is_free) {
      const { data: download } = await supabase
        .from("downloads")
        .select("id")
        .eq("product_id", product.id)
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      hasDownload = Boolean(download);
    } else {
      const { data: purchase } = await supabase
        .from("order_items")
        .select("id, order:orders!inner(status, user_id)")
        .eq("product_id", product.id)
        .eq("order.user_id", user.id)
        .eq("order.status", "completed")
        .limit(1)
        .maybeSingle();

      hasPurchase = Boolean(purchase);

      if (hasPurchase) {
        const { data: licenses } = await supabase
          .from("licenses")
          .select("id, status")
          .eq("product_id", product.id)
          .eq("user_id", user.id);

        hasAnyLicense = Boolean(licenses && licenses.length > 0);
        hasActiveLicense = Boolean(
          licenses && licenses.some((license) => license.status === "active")
        );
      }
    }
  }

  const hasRevokedLicense = hasAnyLicense && !hasActiveLicense;

  const canDownload = Boolean(
    user &&
      (product.is_free ||
        isOwner ||
        isAdmin ||
        (hasPurchase && (!hasAnyLicense || hasActiveLicense)))
  );

  const canReview = Boolean(
    user &&
      !isOwner &&
      !isAdmin &&
      product.moderation_status === "approved" &&
      ((product.is_free && hasDownload) || (!product.is_free && hasPurchase))
  );

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, user_id, rating, title, body, created_at")
    .eq("product_id", product.id)
    .order("created_at", { ascending: false });

  const existingReview = user
    ? (reviews || []).find((review) => review.user_id === user.id) || null
    : null;

  const averageRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : null;

  return (
    <main>
      <SiteHeader />
      <section className="container-shell py-16">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
              Producto
            </p>
            <h1 className="mt-3 text-4xl font-bold text-white">{product.title}</h1>
            <p className="mt-3 text-sm text-[var(--text-soft)]">
              Por {vendor?.store_name || "Tienda"} · Estado: {product.moderation_status}
            </p>

            {product.featured_image_url ? (
              <Image
                src={product.featured_image_url}
                alt={product.title}
                width={1400}
                height={700}
                className="mt-8 h-72 w-full rounded-3xl object-cover"
              />
            ) : null}

            {product.short_description ? (
              <p className="mt-8 text-lg text-white/85">{product.short_description}</p>
            ) : null}

            {(isOwner || isAdmin) && product.rejection_reason ? (
              <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-300">
                Motivo de rechazo actual: {product.rejection_reason}
              </div>
            ) : null}

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Descripcion</h2>
              <p className="mt-4 whitespace-pre-wrap text-[var(--text-soft)]">
                {product.description || "Este producto no tiene descripcion detallada todavia."}
              </p>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Version actual</h2>
              {latestVersion ? (
                <div className="mt-4 space-y-3">
                  <p className="text-lg font-semibold text-white">{latestVersion.version}</p>
                  <p className="text-sm text-[var(--text-soft)]">
                    Publicada el {new Date(latestVersion.created_at).toLocaleString("es-ES")}
                  </p>
                  <p className="whitespace-pre-wrap text-[var(--text-soft)]">
                    {latestVersion.changelog || "Sin changelog para esta version."}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-[var(--text-soft)]">Aun no hay versiones publicadas.</p>
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Historial de versiones</h2>
              {versions && versions.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {versions.map((version) => (
                    <div key={version.id} className="rounded-2xl border border-white/10 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-white">{version.version}</p>
                          {!downloadableVersionIds.has(version.id) ? (
                            <p className="mt-1 text-xs text-amber-300">
                              Version sin archivo descargable asociado
                            </p>
                          ) : null}
                        </div>
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
                <p className="mt-4 text-[var(--text-soft)]">No hay historial de versiones todavia.</p>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm text-[var(--text-soft)]">Precio</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {product.is_free ? "Gratis" : `EUR ${(product.price_cents / 100).toFixed(2)}`}
              </p>

              <div className="mt-6 space-y-4">
                {!user ? (
                  <>
                    <p className="text-sm text-[var(--text-soft)]">
                      Necesitas iniciar sesion para descargar este producto.
                    </p>
                    <Link
                      href="/login"
                      className="inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      Iniciar sesion
                    </Link>
                  </>
                ) : canDownload ? (
                  <>
                    <p className="text-sm text-[var(--text-soft)]">
                      La descarga se generara con un enlace temporal y seguro.
                    </p>
                    <DownloadButton productId={product.id} />
                  </>
                ) : hasRevokedLicense ? (
                  <>
                    <p className="text-sm text-amber-300">
                      Tu licencia para este producto esta revocada. La descarga esta bloqueada.
                    </p>
                    <Link
                      href="/licenses"
                      className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Ver licencias
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[var(--text-soft)]">
                      Este producto requiere una compra completada antes de poder descargarlo.
                    </p>
                    <Link
                      href={`/checkout/${product.id}`}
                      className="inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      Ir al checkout
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Detalles</h2>
              <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
                <p>
                  Compatibilidad: <span className="text-white">{product.compatibility || "Rust"}</span>
                </p>
                <p>
                  Creador: <span className="text-white">{vendor?.store_name || "Tienda"}</span>
                </p>
                <p>
                  Publicado:{" "}
                  <span className="text-white">
                    {new Date(product.created_at).toLocaleDateString("es-ES")}
                  </span>
                </p>
                <p>
                  Version actual:{" "}
                  <span className="text-white">{latestVersion?.version || "Sin version"}</span>
                </p>
                <p>
                  Valoracion media:{" "}
                  <span className="text-white">
                    {averageRating ? `${averageRating.toFixed(1)}/5` : "Sin valoraciones"}
                  </span>
                </p>
              </div>
            </div>

            {vendor?.bio ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold text-white">Sobre el creador</h2>
                <p className="mt-4 text-[var(--text-soft)]">{vendor.bio}</p>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-white">Valoraciones</h2>
              <div className="mt-4 flex items-end gap-4">
                <p className="text-4xl font-bold text-white">
                  {averageRating ? averageRating.toFixed(1) : "--"}
                </p>
                <div className="pb-1 text-sm text-[var(--text-soft)]">
                  <p>{reviews?.length || 0} resenas publicadas</p>
                  <p>
                    {reviews && reviews.length > 0
                      ? "Feedback de compradores reales"
                      : "Aun no hay opiniones para este producto"}
                  </p>
                </div>
              </div>
            </div>

            {canReview && !existingReview ? <ReviewForm productId={product.id} /> : null}

            {existingReview ? (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
                <h2 className="text-xl font-semibold text-white">Tu valoracion</h2>
                <p className="mt-3 text-sm text-emerald-300">
                  Ya has enviado una valoracion para este producto.
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Opiniones de compradores</h2>
            {reviews && reviews.length > 0 ? (
              <div className="mt-5 space-y-4">
                {reviews.map((review) => (
                  <article key={review.id} className="rounded-2xl border border-white/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">
                          {review.title || "Comprador verificado"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-soft)]">
                          {new Date(review.created_at).toLocaleString("es-ES")}
                        </p>
                      </div>
                      <p className="rounded-full border border-white/10 px-3 py-1 text-sm font-semibold text-white">
                        {review.rating}/5
                      </p>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm text-[var(--text-soft)]">
                      {review.body || "Sin comentario adicional."}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-[var(--text-soft)]">
                Aun no hay valoraciones para este producto.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
