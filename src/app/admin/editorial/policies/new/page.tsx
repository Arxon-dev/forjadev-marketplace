import { EditorialPolicyForm } from "@/components/admin/editorial-policy-form";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { requireAdminContext } from "@/lib/auth/admin";

export default async function AdminNewEditorialPolicyPage() {
  await requireAdminContext();

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <EditorialPolicyForm />
      </section>
    </main>
  );
}
