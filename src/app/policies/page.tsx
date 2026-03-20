import Link from "next/link";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { getPublicPolicies } from "@/lib/help/public";
import { createClient } from "@/lib/supabase/server";

function audienceLabel(value: "buyer" | "seller" | "shared") {
  if (value === "buyer") return "Buyer";
  if (value === "seller") return "Seller";
  return "Marketplace";
}

export default async function PoliciesPage() {
  const supabase = await createClient();
  const policies = await getPublicPolicies(supabase);

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-8 lg:p-10">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Policies</p>
          <h1 className="mt-4 text-4xl font-bold text-white">
            Reglas visibles para compra, acceso, licencias, soporte y escalado.
          </h1>
          <p className="mt-4 max-w-3xl text-[var(--text-soft)]">
            Esta capa define las normas del marketplace. Las politicas del seller siguen viviendo
            en cada producto; aqui se publican las reglas globales de ForjaDev.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {policies.map((policy) => (
            <Link
              key={policy.id}
              href={`/policies/${policy.policy_key}`}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20"
            >
              <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">
                {audienceLabel(policy.audience)}
              </span>
              <h2 className="mt-4 text-2xl font-semibold text-white">{policy.title}</h2>
              <p className="mt-3 text-sm text-[var(--text-soft)]">
                {policy.summary || "Policy publica del marketplace."}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
