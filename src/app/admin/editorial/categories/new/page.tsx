import { EditorialCategoryForm } from "@/components/admin/editorial-category-form";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { requireAdminContext } from "@/lib/auth/admin";

export default async function AdminNewEditorialCategoryPage() {
  await requireAdminContext();

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <EditorialCategoryForm />
      </section>
    </main>
  );
}
