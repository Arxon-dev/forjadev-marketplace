import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialPolicyForm } from "@/components/admin/editorial-policy-form";
import { EditorialQuickActions } from "@/components/admin/editorial-quick-actions";
import { EditorialStatusPill } from "@/components/admin/editorial-status-pill";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { Button } from "@/components/ui/button";
import { requireAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

interface PolicyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditorialPolicyDetailPage({ params }: PolicyDetailPageProps) {
  await requireAdminContext();
  const { id } = await params;
  const adminSupabase = createAdminClient();
  const { data: policy } = await adminSupabase
    .from("marketplace_policy_pages")
    .select("id, policy_key, title, summary, body, audience, status, sort_order, seo_title, seo_description, review_notes")
    .eq("id", id)
    .maybeSingle();
  const policyRecord = policy as
    | {
        id: string;
        policy_key: string;
        title: string;
        summary: string | null;
        body: string;
        audience: "buyer" | "seller" | "shared";
        status: "draft" | "published" | "archived";
        sort_order: number;
        seo_title: string | null;
        seo_description: string | null;
        review_notes: string | null;
      }
    | null;

  if (!policyRecord) {
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
            <EditorialStatusPill status={policyRecord.status} />
            <EditorialQuickActions entity="policies" entityId={policyRecord.id} currentStatus={policyRecord.status} />
          </div>
        </div>
        <EditorialPolicyForm policy={policyRecord} />
      </section>
    </main>
  );
}
