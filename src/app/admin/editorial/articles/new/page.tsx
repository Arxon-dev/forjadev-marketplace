import { EditorialArticleForm } from "@/components/admin/editorial-article-form";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { requireAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminNewEditorialArticlePage() {
  await requireAdminContext();
  const adminSupabase = createAdminClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    adminSupabase.from("help_center_categories").select("id, title").order("sort_order", { ascending: true }),
    adminSupabase.from("products").select("id, title").eq("moderation_status", "approved").order("title", { ascending: true }).limit(100),
  ]);

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <EditorialArticleForm categories={categories || []} products={products || []} />
      </section>
    </main>
  );
}
