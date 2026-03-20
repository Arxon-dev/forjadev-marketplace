import { notFound } from "next/navigation";
import { PolicyDetailPageView } from "@/components/help/policy-detail-page-view";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { getPublicPolicies, getPublicPolicyByKey } from "@/lib/help/public";
import { createClient } from "@/lib/supabase/server";

interface PolicyDetailPageProps {
  params: Promise<{ policyKey: string }>;
}

export default async function PolicyDetailPage({ params }: PolicyDetailPageProps) {
  const { policyKey } = await params;
  const supabase = await createClient();
  const policy = await getPublicPolicyByKey(supabase, policyKey);

  if (!policy) {
    notFound();
  }

  const policies = await getPublicPolicies(supabase);
  const relatedPolicies = policies.filter((item) => item.id !== policy.id).slice(0, 4);

  return (
    <main>
      <SiteHeaderServer />
      <PolicyDetailPageView policy={policy} relatedPolicies={relatedPolicies} />
    </main>
  );
}
