import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

interface SellerProfile {
  role: string;
}

interface VendorRow {
  id: string;
  user_id: string;
  store_name: string;
  slug: string;
  bio: string | null;
}

interface ProductOwnerRow {
  id: string;
  vendor_id: string;
  title: string;
  slug: string;
  price_cents: number;
  moderation_status: string;
  rejection_reason: string | null;
}

export interface SellerContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  vendor: VendorRow;
}

export interface OwnedProductContext extends SellerContext {
  product: ProductOwnerRow;
}

export async function requireSellerContext(): Promise<SellerContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<SellerProfile>();

  if (profile?.role !== "seller") {
    redirect("/seller");
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, user_id, store_name, slug, bio")
    .eq("user_id", user.id)
    .single<VendorRow>();

  if (!vendor) {
    redirect("/seller/onboarding");
  }

  return { supabase, user, vendor };
}

export async function requireOwnedProductContext(
  productId: string
): Promise<OwnedProductContext> {
  const { supabase, user, vendor } = await requireSellerContext();

  const { data: product } = await supabase
    .from("products")
    .select("id, vendor_id, title, slug, price_cents, moderation_status, rejection_reason")
    .eq("id", productId)
    .eq("vendor_id", vendor.id)
    .single<ProductOwnerRow>();

  if (!product) {
    redirect("/seller");
  }

  return { supabase, user, vendor, product };
}
