import { notFound } from "next/navigation";
import { HelpCategoryPageView } from "@/components/help/help-category-page-view";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import {
  getHelpArticlesByCategory,
  getHelpCategoryBySlug,
  getPublicPolicies,
} from "@/lib/help/public";
import { createClient } from "@/lib/supabase/server";

interface HelpCategoryPageProps {
  params: Promise<{ categorySlug: string }>;
}

export default async function HelpCategoryPage({ params }: HelpCategoryPageProps) {
  const { categorySlug } = await params;
  const supabase = await createClient();
  const category = await getHelpCategoryBySlug(supabase, categorySlug);

  if (!category) {
    notFound();
  }

  const [articles, policies] = await Promise.all([
    getHelpArticlesByCategory(supabase, category.id),
    getPublicPolicies(supabase),
  ]);

  return (
    <main>
      <SiteHeaderServer />
      <HelpCategoryPageView category={category} articles={articles} policies={policies} />
    </main>
  );
}
