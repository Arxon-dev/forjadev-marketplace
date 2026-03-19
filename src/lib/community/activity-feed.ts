import type { Database } from "@/types/database";

type SupabaseClient = {
  from: (table: string) => any;
};

type FeedItemKind =
  | "seller_release"
  | "seller_update"
  | "discussion_activity"
  | "collection_activity";

export interface ActivityFeedItem {
  id: string;
  kind: FeedItemKind;
  occurredAt: string;
  title: string;
  description: string;
  href: string;
  accent: string;
}

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
}

interface VendorRow {
  id: string;
  store_name: string;
}

interface ProductRow {
  id: string;
  vendor_id: string;
  title: string;
  slug: string;
  short_description: string | null;
  created_at: string;
  updated_at: string;
}

interface DiscussionRow {
  id: string;
  product_id: string;
  author_user_id: string;
  title: string;
  updated_at: string;
}

interface CollectionRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  description: string | null;
  updated_at: string;
}

function formatActor(profile: ProfileRow | undefined) {
  return profile?.display_name || profile?.username || profile?.email || "Usuario ForjaDev";
}

export async function getUserActivityFeed(
  supabase: SupabaseClient,
  adminSupabase: SupabaseClient,
  userId: string
) {
  const [followResult, wishlistResult] = await Promise.all([
    supabase.from("seller_followers").select("vendor_id").eq("user_id", userId),
    supabase.from("wishlists").select("product_id").eq("user_id", userId),
  ]);

  const followedVendorIds = Array.from(
    new Set(
      ((followResult.data || []) as Array<{ vendor_id: string }>).map((row) => row.vendor_id)
    )
  );
  const wishlistProductIds = Array.from(
    new Set(
      ((wishlistResult.data || []) as Array<{ product_id: string }>).map((row) => row.product_id)
    )
  );

  const [followedProductsResult, vendorResult, discussionsResult, discussionProductsResult] =
    await Promise.all([
      followedVendorIds.length > 0
        ? supabase
            .from("products")
            .select("id, vendor_id, title, slug, short_description, created_at, updated_at")
            .in("vendor_id", followedVendorIds)
            .eq("moderation_status", "approved")
            .order("updated_at", { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [] as ProductRow[] }),
      followedVendorIds.length > 0
        ? supabase.from("vendors").select("id, store_name").in("id", followedVendorIds)
        : Promise.resolve({ data: [] as VendorRow[] }),
      wishlistProductIds.length > 0
        ? supabase
            .from("product_discussions")
            .select("id, product_id, author_user_id, title, updated_at")
            .in("product_id", wishlistProductIds)
            .order("updated_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [] as DiscussionRow[] }),
      wishlistProductIds.length > 0
        ? supabase.from("products").select("id, title, slug").in("id", wishlistProductIds)
        : Promise.resolve({
            data: [] as Array<{ id: string; title: string; slug: string }>,
          }),
    ]);

  const collectionMatchesResult =
    wishlistProductIds.length > 0
      ? await supabase
          .from("collection_items")
          .select("collection_id, product_id")
          .in("product_id", wishlistProductIds)
      : { data: [] as Array<{ collection_id: string; product_id: string }> };

  const matchedCollectionIds = Array.from(
    new Set(
      ((collectionMatchesResult.data || []) as Array<{ collection_id: string }>).map(
        (row) => row.collection_id
      )
    )
  );

  const collectionsResult =
    matchedCollectionIds.length > 0
      ? await supabase
          .from("collections")
          .select("id, user_id, title, slug, description, updated_at")
          .in("id", matchedCollectionIds)
          .eq("is_public", true)
          .order("updated_at", { ascending: false })
          .limit(10)
      : { data: [] as CollectionRow[] };

  const discussionAuthorIds = Array.from(
    new Set(
      ((discussionsResult.data || []) as DiscussionRow[]).map((discussion) => discussion.author_user_id)
    )
  );
  const collectionOwnerIds = Array.from(
    new Set(
      ((collectionsResult.data || []) as CollectionRow[])
        .map((collection) => collection.user_id)
        .filter((ownerId) => ownerId !== userId)
    )
  );
  const profileIds = Array.from(new Set([...discussionAuthorIds, ...collectionOwnerIds]));

  const profilesResult =
    profileIds.length > 0
      ? await adminSupabase
          .from("profiles")
          .select("id, username, display_name, email")
          .in("id", profileIds)
      : { data: [] as ProfileRow[] };

  const vendorById = new Map(
    ((vendorResult.data || []) as VendorRow[]).map((vendor) => [vendor.id, vendor])
  );
  const productById = new Map(
    ((discussionProductsResult.data || []) as Array<{ id: string; title: string; slug: string }>).map(
      (product) => [product.id, product]
    )
  );
  const profileById = new Map(
    ((profilesResult.data || []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );

  const matchedCollectionProducts = new Map<string, Set<string>>();
  ((collectionMatchesResult.data || []) as Array<{ collection_id: string; product_id: string }>).forEach(
    (row) => {
      const current = matchedCollectionProducts.get(row.collection_id) || new Set<string>();
      current.add(row.product_id);
      matchedCollectionProducts.set(row.collection_id, current);
    }
  );

  const sellerItems: ActivityFeedItem[] = ((followedProductsResult.data || []) as ProductRow[]).map(
    (product) => {
      const vendor = vendorById.get(product.vendor_id);
      const isFreshRelease =
        Math.abs(
          new Date(product.updated_at).getTime() - new Date(product.created_at).getTime()
        ) < 5 * 60 * 1000;

      return {
        id: `seller-${product.id}`,
        kind: isFreshRelease ? "seller_release" : "seller_update",
        occurredAt: product.updated_at,
        title: isFreshRelease
          ? `${vendor?.store_name || "Un seller"} publico ${product.title}`
          : `${vendor?.store_name || "Un seller"} actualizo ${product.title}`,
        description:
          product.short_description ||
          (isFreshRelease
            ? "Nuevo producto publicado por un seller que sigues."
            : "Producto actualizado por un seller que sigues."),
        href: `/products/${product.slug}`,
        accent: "Seguimiento",
      };
    }
  );

  const discussionItems: ActivityFeedItem[] = ((discussionsResult.data || []) as DiscussionRow[]).map(
    (discussion) => {
      const product = productById.get(discussion.product_id);
      const author = formatActor(profileById.get(discussion.author_user_id));

      return {
        id: `discussion-${discussion.id}`,
        kind: "discussion_activity",
        occurredAt: discussion.updated_at,
        title: `Nueva conversacion sobre ${product?.title || "un producto en wishlist"}`,
        description: `${author} abrio o movio el hilo "${discussion.title}"`,
        href: product?.slug
          ? `/products/${product.slug}/discussions/${discussion.id}`
          : "/products",
        accent: "Discusion",
      };
    }
  );

  const collectionItems: ActivityFeedItem[] = ((collectionsResult.data || []) as CollectionRow[])
    .filter((collection) => collection.user_id !== userId)
    .map((collection) => {
      const owner = formatActor(profileById.get(collection.user_id));
      const matchingCount = matchedCollectionProducts.get(collection.id)?.size || 0;

      return {
        id: `collection-${collection.id}`,
        kind: "collection_activity",
        occurredAt: collection.updated_at,
        title: `${owner} actualizo la coleccion ${collection.title}`,
        description:
          matchingCount > 0
            ? `Incluye ${matchingCount} producto${matchingCount > 1 ? "s" : ""} que ya tienes en wishlist.`
            : collection.description || "Coleccion publica actualizada recientemente.",
        href: `/collections/${collection.slug}`,
        accent: "Coleccion",
      };
    });

  return [...sellerItems, ...discussionItems, ...collectionItems]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 24);
}
