import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { createClient } from "@/lib/supabase/server";

export default async function LicensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: licenses } = await supabase
    .from("licenses")
    .select(
      "id, license_key, status, issued_at, last_validated_at, product:products(id, title, slug)"
    )
    .eq("user_id", user.id)
    .order("issued_at", { ascending: false });

  const activeCount = (licenses || []).filter((license) => license.status === "active").length;
  const revokedCount = (licenses || []).filter((license) => license.status === "revoked").length;

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Licencias</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Tu biblioteca de licencias</h1>
        <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
          Gestiona las claves emitidas para tus compras y vuelve rapidamente a cada producto.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Licencias activas</p>
            <p className="mt-2 text-3xl font-bold text-white">{activeCount}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Licencias revocadas</p>
            <p className="mt-2 text-3xl font-bold text-white">{revokedCount}</p>
          </div>
        </div>

        {revokedCount > 0 ? (
          <div className="mt-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
            <p className="text-sm font-semibold text-amber-300">
              Tienes una o mas licencias revocadas.
            </p>
            <p className="mt-2 text-sm text-amber-200">
              Mientras una licencia este revocada, la descarga del producto asociado permanecera bloqueada.
              Si crees que se trata de un error, revisa el producto o contacta con soporte del marketplace.
            </p>
          </div>
        ) : null}

        {licenses && licenses.length > 0 ? (
          <div className="mt-10 grid gap-4">
            {licenses.map((license) =>
              (() => {
                const product = Array.isArray(license.product)
                  ? license.product[0]
                  : license.product;
                const isRevoked = license.status === "revoked";

                return (
                  <article
                    key={license.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-[var(--text-soft)]">Producto</p>
                        <h2 className="mt-2 text-xl font-semibold text-white">
                          {product?.title || "Producto"}
                        </h2>
                        <p className="mt-2 text-sm text-[var(--text-soft)]">
                          Emitida el {new Date(license.issued_at).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                      <div
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                          isRevoked
                            ? "border border-amber-500/20 bg-amber-500/10 text-amber-300"
                            : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        }`}
                      >
                        {license.status}
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-soft)]">
                        Clave
                      </p>
                      <p className="mt-2 break-all font-mono text-sm text-white">
                        {license.license_key}
                      </p>
                    </div>

                    {isRevoked ? (
                      <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                        <p className="text-sm text-amber-200">
                          Esta licencia esta revocada y no habilita descargas mientras mantenga este estado.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-[var(--text-soft)]">
                        Ultima validacion:{" "}
                        {license.last_validated_at
                          ? new Date(license.last_validated_at).toLocaleString("es-ES")
                          : "Sin validar todavia"}
                      </p>

                      {product?.slug ? (
                        <Link
                          href={`/products/${product.slug}`}
                          className="text-sm font-medium text-white hover:underline"
                        >
                          Ver producto
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })()
            )}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">Aun no tienes licencias emitidas.</p>
          </div>
        )}
      </section>
    </main>
  );
}
