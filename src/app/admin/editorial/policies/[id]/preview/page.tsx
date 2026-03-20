import { notFound } from "next/navigation";
import { PolicyDetailPageView } from "@/components/help/policy-detail-page-view";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { requireAdminContext } from "@/lib/auth/admin";
import {
  getPreviewPolicyById,
  getPreviewRelatedPolicies,
} from "@/lib/help/preview";
import { createAdminClient } from "@/lib/supabase/admin";

interface PolicyPreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditorialPolicyPreviewPage({
  params,
}: PolicyPreviewPageProps) {
  await requireAdminContext();
  const { id } = await params;
  const adminSupabase = createAdminClient();
  const policy = await getPreviewPolicyById(adminSupabase, id);

  if (!policy) {
    notFound();
  }

  const relatedPolicies = await getPreviewRelatedPolicies(adminSupabase, policy.id);

  return (
    <main>
      <SiteHeaderServer />
      <PolicyDetailPageView
        policy={policy}
        relatedPolicies={relatedPolicies}
        preview={{
          status: policy.status,
          backHref: `/admin/editorial/policies/${policy.id}`,
        }}
      />
    </main>
  );
}
