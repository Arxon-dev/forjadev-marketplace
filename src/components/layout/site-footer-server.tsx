import { SiteFooter } from "@/components/layout/site-footer";
import { getPublicHelpCategories, getPublicPolicies } from "@/lib/help/public";
import { createClient } from "@/lib/supabase/server";

export async function SiteFooterServer() {
  const supabase = await createClient();
  const [categories, policies] = await Promise.all([
    getPublicHelpCategories(supabase),
    getPublicPolicies(supabase),
  ]);

  return <SiteFooter categories={categories} policies={policies} />;
}
