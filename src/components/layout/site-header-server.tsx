import { SiteHeader } from "@/components/layout/site-header";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeaderServer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <SiteHeader />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <SiteHeader
      isAuthenticated
      userEmail={user.email ?? null}
      role={profile?.role ?? null}
    />
  );
}
