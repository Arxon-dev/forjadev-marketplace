import { redirect } from "next/navigation";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { SellerPageContent } from "@/components/seller/seller-page-content";
import { createClient } from "@/lib/supabase/server";

export default async function SellerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main>
      <SiteHeaderServer />
      <SellerPageContent userId={user.id} />
    </main>
  );
}
