import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialArticleForm } from "@/components/admin/editorial-article-form";
import { EditorialQuickActions } from "@/components/admin/editorial-quick-actions";
import { EditorialStatusPill } from "@/components/admin/editorial-status-pill";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

interface ArticleDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditorialArticleDetailPage({ params }: ArticleDetailPageProps) {
  await requireAdminContext();
  const { id } = await params;
  const adminSupabase = createAdminClient();
  const [{ data: article }, { data: categories }, { data: products }] = await Promise.all([
    adminSupabase
      .from("help_center_articles")
      .select("id, category_id, related_product_id, article_type, audience, slug, title, summary, body, status, is_featured, sort_order, seo_title, seo_description, review_notes")
      .eq("id", id)
      .maybeSingle(),
    adminSupabase.from("help_center_categories").select("id, title").order("sort_order", { ascending: true }),
    adminSupabase.from("products").select("id, title").eq("moderation_status", "approved").order("title", { ascending: true }).limit(100),
  ]);
  const articleRecord = article as
    | {
        id: string;
        category_id: string;
        related_product_id: string | null;
        article_type: "guide" | "policy" | "faq" | "troubleshooting" | "post_sale";
        audience: "buyer" | "seller" | "shared";
        slug: string;
        title: string;
        summary: string | null;
        body: string;
        status: "draft" | "published" | "archived";
        is_featured: boolean;
        sort_order: number;
        seo_title: string | null;
        seo_description: string | null;
        review_notes: string | null;
      }
    | null;

  if (!articleRecord) {
    notFound();
  }

  return (
    <main>
      <SiteHeaderServer />
      <section className="container-shell py-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link href="/admin/editorial">
            <Button variant="secondary">Volver a editorial</Button>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <EditorialStatusPill status={articleRecord.status} />
            <EditorialQuickActions entity="articles" entityId={articleRecord.id} currentStatus={articleRecord.status} />
          </div>
        </div>
        <EditorialArticleForm article={articleRecord} categories={categories || []} products={products || []} />
      </section>
    </main>
  );
}
