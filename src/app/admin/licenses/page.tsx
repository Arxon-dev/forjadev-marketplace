import Link from "next/link";
import { LicenseActions } from "@/components/admin/license-actions";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

type LicenseRow = {
  id: string;
  license_key: string;
  status: "active" | "revoked";
  issued_at: string;
  last_validated_at: string | null;
  product_id: string;
  user_id: string;
};

type ProductLookupRow = {
  id: string;
  title: string;
  slug: string;
};

type ProfileLookupRow = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
};

interface AdminLicensesPageProps {
  searchParams?: Promise<{
    status?: string;
  }>;
}

export default async function AdminLicensesPage({ searchParams }: AdminLicensesPageProps) {
  await requireAdminContext();
  const adminSupabase = createAdminClient();
  const params = (await searchParams) || {};
  const selectedStatus = params.status || "all";

  let query = adminSupabase
    .from("licenses")
    .select("id, license_key, status, issued_at, last_validated_at, product_id, user_id")
    .order("issued_at", { ascending: false }) as any;

  if (selectedStatus !== "all") {
    query = query.eq("status", selectedStatus);
  }

  const { data: licenses } = (await query) as { data: LicenseRow[] | null };
  const { data: allLicenses } = (await adminSupabase
    .from("licenses")
    .select("status")) as { data: Array<{ status: "active" | "revoked" }> | null };

  const productIds = Array.from(new Set((licenses || []).map((license) => license.product_id)));
  const userIds = Array.from(new Set((licenses || []).map((license) => license.user_id)));

  const { data: products } = (productIds.length
    ? await adminSupabase.from("products").select("id, title, slug").in("id", productIds)
    : { data: [] as ProductLookupRow[] }) as { data: ProductLookupRow[] | null };

  const { data: profiles } = (userIds.length
    ? await adminSupabase
        .from("profiles")
        .select("id, email, username, display_name")
        .in("id", userIds)
    : { data: [] as ProfileLookupRow[] }) as { data: ProfileLookupRow[] | null };

  const productById = new Map((products || []).map((product) => [product.id, product]));
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

  const counts = {
    active: (allLicenses || []).filter((license) => license.status === "active").length,
    revoked: (allLicenses || []).filter((license) => license.status === "revoked").length,
  };

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--text-soft)]">Admin</p>
            <h1 className="mt-3 text-4xl font-bold text-white">Gestion de licencias</h1>
            <p className="mt-3 max-w-2xl text-[var(--text-soft)]">
              Revisa, revoca o reactiva licencias emitidas para productos de pago.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="secondary">Volver a moderacion</Button>
          </Link>
        </div>

        <div className="mb-6">
          <Link href="/admin/audit">
            <Button variant="secondary">Ver auditoria</Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Licencias activas</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.active}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[var(--text-soft)]">Licencias revocadas</p>
            <p className="mt-2 text-3xl font-bold text-white">{counts.revoked}</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/admin/licenses">
            <Button variant={selectedStatus === "all" ? "primary" : "secondary"}>Todas</Button>
          </Link>
          <Link href="/admin/licenses?status=active">
            <Button variant={selectedStatus === "active" ? "primary" : "secondary"}>Activas</Button>
          </Link>
          <Link href="/admin/licenses?status=revoked">
            <Button variant={selectedStatus === "revoked" ? "primary" : "secondary"}>Revocadas</Button>
          </Link>
        </div>

        {licenses && licenses.length > 0 ? (
          <div className="mt-8 space-y-4">
            {licenses.map((license) => {
              const product = productById.get(license.product_id);
              const profile = profileById.get(license.user_id);

              return (
                <article
                  key={license.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-[var(--text-soft)]">Producto</p>
                        <h2 className="text-lg font-semibold text-white">
                          {product?.title || "Producto"}
                        </h2>
                      </div>
                      <div>
                        <p className="text-sm text-[var(--text-soft)]">Usuario</p>
                        <p className="text-white">
                          {profile?.display_name || profile?.username || profile?.email || license.user_id}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-[var(--text-soft)]">Clave</p>
                        <p className="font-mono text-sm text-white">{license.license_key}</p>
                      </div>
                      <p className="text-xs text-[var(--text-soft)]">
                        Emitida: {new Date(license.issued_at).toLocaleString("es-ES")} · Ultima validacion:{" "}
                        {license.last_validated_at
                          ? new Date(license.last_validated_at).toLocaleString("es-ES")
                          : "Sin validar"}
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                        {license.status}
                      </div>

                      {product?.slug ? (
                        <Link
                          href={`/products/${product.slug}`}
                          className="block text-sm text-white hover:underline"
                        >
                          Ver producto
                        </Link>
                      ) : null}

                      <LicenseActions
                        licenseId={license.id}
                        currentStatus={license.status as "active" | "revoked"}
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
            <p className="text-[var(--text-soft)]">No hay licencias en esta vista.</p>
          </div>
        )}
      </section>
    </main>
  );
}
