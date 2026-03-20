import { notFound } from "next/navigation";
import { HelpCategoryPageView } from "@/components/help/help-category-page-view";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { requireAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPreviewArticlesByCategory, getPreviewHelpCategoryById, getPreviewPolicies } from "@/lib/help/preview";

interface CategoryPreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditorialCategoryPreviewPage({
  params,
}: CategoryPreviewPageProps) {
  await requireAdminContext();
  const { id } = await params;
  const adminSupabase = createAdminClient();
  const category = await getPreviewHelpCategoryById(adminSupabase, id);

  if (!category) {
    notFound();
  }

  const [articles, policies] = await Promise.all([
    getPreviewArticlesByCategory(adminSupabase, category.id),
    getPreviewPolicies(adminSupabase),
  ]);

  return (
    <main>
      <SiteHeaderServer />
      <HelpCategoryPageView
        category={category}
        articles={articles}
        policies={policies}
        preview={{
          status: category.status,
          backHref: `/admin/editorial/categories/${category.id}`,
          categoryHref: `/admin/editorial/categories/${category.id}/preview`,
        }}
      />
    </main>
  );
}
