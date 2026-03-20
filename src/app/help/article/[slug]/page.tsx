import { notFound } from "next/navigation";
import { HelpArticlePageView } from "@/components/help/help-article-page-view";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import {
  getHelpArticleBySlug,
  getRelatedHelpArticles,
} from "@/lib/help/public";
import { createClient } from "@/lib/supabase/server";

interface HelpArticlePageProps {
  params: Promise<{ slug: string }>;
}

export default async function HelpArticlePage({ params }: HelpArticlePageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const article = await getHelpArticleBySlug(supabase, slug);

  if (!article) {
    notFound();
  }

  const relatedArticles = await getRelatedHelpArticles(
    supabase,
    article.category.id,
    article.id,
    4
  );

  return (
    <main>
      <SiteHeaderServer />
      <HelpArticlePageView article={article} relatedArticles={relatedArticles} />
    </main>
  );
}
