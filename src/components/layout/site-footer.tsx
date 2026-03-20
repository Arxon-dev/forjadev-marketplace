import Link from "next/link";
import type { HelpCategory, PolicyListItem } from "@/lib/help/public";

interface SiteFooterProps {
  categories: HelpCategory[];
  policies: PolicyListItem[];
}

export function SiteFooter({ categories, policies }: SiteFooterProps) {
  const featuredCategories = categories.slice(0, 4);
  const featuredPolicies = policies.slice(0, 5);

  return (
    <footer className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(9,14,27,0.2)_0%,rgba(9,14,27,0.95)_100%)]">
      <div className="container-shell py-14">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
              Marketplace serio
            </p>
            <h2 className="mt-4 max-w-lg text-2xl font-bold text-white">
              Compra, descarga y soporte con reglas claras y una capa publica de confianza.
            </h2>
            <p className="mt-4 max-w-xl text-sm text-[var(--text-soft)]">
              ForjaDev organiza ayuda, licencias, escalado y policies del marketplace para que el
              comprador entienda el flujo antes y despues de pagar.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/help"
                className="inline-flex rounded-2xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
              >
                Abrir help center
              </Link>
              <Link
                href="/policies"
                className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Revisar policies
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
              Ayuda publica
            </h3>
            <div className="mt-4 space-y-3">
              <Link href="/help" className="block text-white transition hover:text-[var(--primary)]">
                Help center
              </Link>
              {featuredCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/help/${category.slug}`}
                  className="block text-sm text-[var(--text-soft)] transition hover:text-white"
                >
                  {category.title}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
              Policies
            </h3>
            <div className="mt-4 space-y-3">
              <Link
                href="/policies"
                className="block text-white transition hover:text-[var(--primary)]"
              >
                Todas las policies
              </Link>
              {featuredPolicies.map((policy) => (
                <Link
                  key={policy.id}
                  href={`/policies/${policy.policy_key}`}
                  className="block text-sm text-[var(--text-soft)] transition hover:text-white"
                >
                  {policy.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
