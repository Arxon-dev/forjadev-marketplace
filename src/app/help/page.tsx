import Link from "next/link";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import {
  getFeaturedHelpArticles,
  getPublicHelpCategories,
  getPublicPolicies,
} from "@/lib/help/public";
import { createClient } from "@/lib/supabase/server";

function audienceLabel(value: "buyer" | "seller" | "shared") {
  if (value === "buyer") return "Buyer";
  if (value === "seller") return "Seller";
  return "Marketplace";
}

export default async function HelpCenterPage() {
  const supabase = await createClient();
  const [categories, featuredArticles, policies] = await Promise.all([
    getPublicHelpCategories(supabase),
    getFeaturedHelpArticles(supabase, 6),
    getPublicPolicies(supabase),
  ]);

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(91,140,255,0.22),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-8 lg:p-10">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Help center</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold text-white">
            Compra con claridad, entiende tus licencias y sabe exactamente como escalar soporte.
          </h1>
          <p className="mt-4 max-w-2xl text-[var(--text-soft)]">
            Esta capa publica concentra documentacion, reglas del marketplace y caminos claros
            entre compra, postventa, licencias, tickets y disputas.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/policies"
              className="inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Ver policies
            </Link>
            <Link
              href="/support"
              className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Abrir soporte privado
            </Link>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-white">Explora por area</h2>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            La ayuda publica se organiza por compra, acceso, soporte y confianza del marketplace.
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/help/${category.slug}`}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20 hover:bg-white/8"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-soft)]">
                  {category.icon || "guide"}
                </p>
                <h3 className="mt-4 text-xl font-semibold text-white">{category.title}</h3>
                <p className="mt-3 text-sm text-[var(--text-soft)]">
                  {category.description || "Documentacion publica para esta area del marketplace."}
                </p>
                <p className="mt-5 text-sm font-semibold text-white">Abrir categoria</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold text-white">Articulos destacados</h2>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              Guias publicas para friccion real de compra, soporte y postventa.
            </p>

            {featuredArticles.length > 0 ? (
              <div className="mt-6 grid gap-4">
                {featuredArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/help/article/${article.slug}`}
                    className="rounded-2xl border border-white/10 bg-black/10 p-5 transition hover:border-white/20"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                        {article.category.title}
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                        {audienceLabel(article.audience)}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-white">{article.title}</h3>
                    <p className="mt-3 text-sm text-[var(--text-soft)]">
                      {article.summary || "Contenido editorial publico para orientar al comprador."}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 px-6 py-12 text-center">
                <p className="text-[var(--text-soft)]">
                  Todavia no hay articulos destacados publicados.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-bold text-white">Policies clave</h2>
              <div className="mt-5 space-y-4">
                {policies.slice(0, 5).map((policy) => (
                  <Link
                    key={policy.id}
                    href={`/policies/${policy.policy_key}`}
                    className="block rounded-2xl border border-white/10 bg-black/10 p-4 transition hover:border-white/20"
                  >
                    <p className="font-semibold text-white">{policy.title}</p>
                    <p className="mt-2 text-sm text-[var(--text-soft)]">
                      {policy.summary || "Norma publica del marketplace."}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-bold text-white">Escalado correcto</h2>
              <div className="mt-4 space-y-3 text-sm text-[var(--text-soft)]">
                <p>Usa soporte con seller para dudas de uso, instalacion, actualizaciones y problemas operativos.</p>
                <p>Usa disputas cuando el problema ya excede soporte razonable o requiere revision del marketplace.</p>
                <p>Las licencias y el acceso a descargas dependen del estado real de compra y validacion.</p>
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
