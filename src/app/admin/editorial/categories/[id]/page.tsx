import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialCategoryForm } from "@/components/admin/editorial-category-form";
import { EditorialQuickActions } from "@/components/admin/editorial-quick-actions";
import { EditorialStatusPill } from "@/components/admin/editorial-status-pill";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

interface CategoryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditorialCategoryDetailPage({ params }: CategoryDetailPageProps) {
  await requireAdminContext();
  const { id } = await params;
  const adminSupabase = createAdminClient();
  const { data: category } = await adminSupabase
    .from("help_center_categories")
    .select("id, title, slug, description, icon, sort_order, status")
    .eq("id", id)
    .maybeSingle();
  const categoryRecord = category as
    | {
        id: string;
        title: string;
        slug: string;
        description: string | null;
        icon: string | null;
        sort_order: number;
        status: "draft" | "published" | "archived";
      }
    | null;

  if (!categoryRecord) {
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
            <EditorialStatusPill status={categoryRecord.status} />
            <EditorialQuickActions
              entity="categories"
              entityId={categoryRecord.id}
              currentStatus={categoryRecord.status}
            />
          </div>
        </div>
        <EditorialCategoryForm category={categoryRecord} />
      </section>
    </main>
  );
}
