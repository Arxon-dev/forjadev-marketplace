import { redirect } from "next/navigation";
import { AccountControlCenter } from "@/components/account/account-control-center";
import { SiteHeaderServer } from "@/components/layout/site-header-server";
import { createClient } from "@/lib/supabase/server";

interface ProfileRow {
  display_name: string | null;
  username: string | null;
  role: string | null;
}

interface LinkedIdentityRow {
  id: string;
  provider: "discord" | "steam";
  provider_email: string | null;
  provider_username: string | null;
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    profileResult,
    identitiesResult,
    wishlistCountResult,
    followsCountResult,
    collectionsCountResult,
    ordersCountResult,
    licensesCountResult,
    notificationsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, username, role").eq("id", user.id).single(),
    supabase
      .from("user_provider_identities")
      .select("id, provider, provider_email, provider_username")
      .eq("user_id", user.id)
      .order("provider", { ascending: true }),
    supabase.from("wishlists").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("seller_followers")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase.from("collections").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("licenses").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", user.id)
      .eq("is_read", false),
  ]);

  const profile = (profileResult.data || null) as ProfileRow | null;
  const linkedIdentities = (identitiesResult.data || []) as LinkedIdentityRow[];

  return (
    <main>
      <SiteHeaderServer />
      <AccountControlCenter
        email={user.email ?? null}
        role={profile?.role ?? null}
        initialDisplayName={profile?.display_name || ""}
        initialUsername={profile?.username || ""}
        unreadNotifications={notificationsResult.count || 0}
        linkedIdentities={linkedIdentities.map((identity) => ({
          id: identity.id,
          provider: identity.provider,
          providerEmail: identity.provider_email,
          providerUsername: identity.provider_username,
        }))}
        shortcuts={[
          { label: "Pedidos", value: String(ordersCountResult.count || 0), href: "/orders" },
          { label: "Licencias", value: String(licensesCountResult.count || 0), href: "/licenses" },
          { label: "Guardados", value: String(wishlistCountResult.count || 0), href: "/dashboard" },
          { label: "Feed", value: String(notificationsResult.count || 0), href: "/feed" },
          { label: "Siguiendo", value: String(followsCountResult.count || 0), href: "/dashboard" },
          { label: "Colecciones", value: String(collectionsCountResult.count || 0), href: "/collections" },
        ]}
      />
    </main>
  );
}
