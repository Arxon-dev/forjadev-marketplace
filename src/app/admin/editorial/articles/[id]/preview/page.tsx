import { notFound } from "next/navigation";
import { HelpArticlePageView } from "@/components/help/help-article-page-view";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { requireAdminContext } from "@/lib/auth/admin";
import {
  getPreviewArticleById,
  getPreviewRelatedArticles,
} from "@/lib/help/preview";
import { createAdminClient } from "@/lib/supabase/admin";

interface ArticlePreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditorialArticlePreviewPage({
  params,
}: ArticlePreviewPageProps) {
  await requireAdminContext();
  const { id } = await params;
  const adminSupabase = createAdminClient();
  const article = await getPreviewArticleById(adminSupabase, id);

  if (!article) {
    notFound();
  }

  const relatedArticles = await getPreviewRelatedArticles(
    adminSupabase,
    article.category.id,
    article.id
  );

  return (
    <main>
      <SiteHeaderServer />
      <HelpArticlePageView
        article={article}
        relatedArticles={relatedArticles}
        preview={{
          status: article.status,
          backHref: `/admin/editorial/articles/${article.id}`,
          categoryHref: `/admin/editorial/categories/${article.category.id}/preview`,
        }}
      />
    </main>
  );
}
