import Link from "next/link";
import { ModerationStatusPill } from "@/components/admin/moderation-status-pill";
import { RiskScoreMeter } from "@/components/admin/risk-score-meter";
import { RiskSeverityPill } from "@/components/admin/risk-severity-pill";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";

interface AdminPageProps {
  searchParams?: Promise<{
    status?: string;
  }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { supabase } = await requireAdminContext();
  const params = (await searchParams) || {};
  const selectedStatus = params.status || "all";

  let queueQuery = supabase
    .from("products")
    .select("id, title, slug, moderation_status, created_at, rejection_reason, vendor_id")
    .order("created_at", { ascending: false });

  if (selectedStatus === "all") {
    queueQuery = queueQuery.neq("moderation_status", "approved");
  } else {
    queueQuery = queueQuery.eq("moderation_status", selectedStatus);
  }

  const { data: products } = await queueQuery;

  const { data: allQueueProducts } = await supabase
    .from("products")
    .select("moderation_status")
    .neq("moderation_status", "approved");

  const productIds = (products || []).map((product) => product.id);

  const vendorIds = Array.from(new Set((products || []).map((product) => product.vendor_id)));
  const [{ data: vendors }, { data: flags }, { data: riskSnapshots }] = await Promise.all([
    vendorIds.length
      ? supabase.from("vendors").select("id, store_name").in("id", vendorIds)
      : Promise.resolve({ data: [] }),
    productIds.length
      ? supabase
          .from("moderation_flags")
          .select("product_id, severity, is_active")
          .in("product_id", productIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [] }),
    productIds.length
      ? supabase
          .from("product_risk_snapshots")
          .select("product_id, risk_score")
          .in("product_id", productIds)
      : Promise.resolve({ data: [] }),
  ]);

  const vendorById = new Map((vendors || []).map((vendor) => [vendor.id, vendor.store_name]));
  const flagByProductId = new Map((flags || []).map((flag) => [flag.product_id, flag]));
  const riskScoreByProductId = new Map(
    (riskSnapshots || []).map((snapshot) => [snapshot.product_id, snapshot.risk_score])
  );
  const counts = {
    pending: (allQueueProducts || []).filter((product) => product.moderation_status === "pending").length,
    draft: (allQueueProducts || []).filter((product) => product.moderation_status === "draft").length,
    rejected: (allQueueProducts || []).filter((product) => product.moderation_status === "rejected").length,
    hidden: (allQueueProducts || []).filter((product) => product.moderation_status === "hidden").length,
  };

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">
            Admin
          </p>
          <h1 className="mt-3 text-4xl font-bold text-white">Cola de moderacion</h1>
          <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
            Revisa productos pendientes, rechazados, ocultos o en borrador desde un flujo centralizado.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Pendientes</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.pending}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Borrador</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.draft}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Rechazados</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.rejected}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Ocultos</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.hidden}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/admin/analytics">
            <Button variant="secondary">Analytics</Button>
          </Link>
          <Link href="/admin/campaigns">
            <Button variant="secondary">Campaign Ops</Button>
          </Link>
          <Link href="/admin/support">
            <Button variant="secondary">Support Ops</Button>
          </Link>
          <Link href="/admin/risk">
            <Button variant="secondary">Risk Ops</Button>
          </Link>
          <Link href="/admin/licenses">
            <Button variant="secondary">Licencias</Button>
          </Link>
          <Link href="/admin/audit">
            <Button variant="secondary">Auditoria</Button>
          </Link>
          <Link href="/admin">
            <Button variant={selectedStatus === "all" ? "primary" : "secondary"}>Todos</Button>
          </Link>
          <Link href="/admin?status=pending">
            <Button variant={selectedStatus === "pending" ? "primary" : "secondary"}>Pendientes</Button>
          </Link>
          <Link href="/admin?status=draft">
            <Button variant={selectedStatus === "draft" ? "primary" : "secondary"}>Borrador</Button>
          </Link>
          <Link href="/admin?status=rejected">
            <Button variant={selectedStatus === "rejected" ? "primary" : "secondary"}>Rechazados</Button>
          </Link>
          <Link href="/admin?status=hidden">
            <Button variant={selectedStatus === "hidden" ? "primary" : "secondary"}>Ocultos</Button>
          </Link>
        </div>

        {products && products.length > 0 ? (
          <div className="mt-8 space-y-4">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <h2 className="text-lg font-semibold text-white">{product.title}</h2>
                  <p className="mt-1 text-sm text-[var(--text-soft)]">
                    Seller: {vendorById.get(product.vendor_id) || "Tienda"}
                  </p>
                  <div className="mt-3 max-w-sm">
                    <RiskScoreMeter
                      score={riskScoreByProductId.get(product.id) || 0}
                      label="Riesgo operativo"
                      compact
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <ModerationStatusPill status={product.moderation_status} />
                    {flagByProductId.get(product.id) ? (
                      <RiskSeverityPill
                        severity={flagByProductId.get(product.id)?.severity || "low"}
                      />
                    ) : null}
                  </div>
                  {product.rejection_reason ? (
                    <p className="mt-2 text-sm text-amber-300">
                      Motivo anterior: {product.rejection_reason}
                    </p>
                  ) : null}
                </div>

                <div className="flex gap-3">
                  <Link href={`/products/${product.slug}`}>
                    <Button variant="secondary">Ver ficha</Button>
                  </Link>
                  <Link href={`/admin/products/${product.id}`}>
                    <Button>Revisar</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">No hay productos en esta vista de moderacion.</p>
          </div>
        )}
      </section>
    </main>
  );
}
