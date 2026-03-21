type SupabaseClient = {
  from: (table: string) => any;
};

interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
}

interface CollectionRow {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  description: string | null;
  updated_at: string;
}

interface CollectionItemRow {
  collection_id: string;
  product_id: string;
  sort_order: number;
  created_at: string;
  product:
    | {
        id: string;
        title: string;
        slug: string;
      }[]
    | {
        id: string;
        title: string;
        slug: string;
      }
    | null;
}

function formatActor(profile?: ProfileRow | null) {
  return profile?.display_name || profile?.username || profile?.email || "Usuario ForjaDev";
}

function resolveProduct(
  product:
    | {
        id: string;
        title: string;
        slug: string;
      }[]
    | {
        id: string;
        title: string;
        slug: string;
      }
    | null
) {
  return Array.isArray(product) ? (product[0] ?? null) : product;
}

export async function getUserEngagementLoopSnapshot(
  supabase: SupabaseClient,
  adminSupabase: SupabaseClient,
  userId: string
) {
  const [wishlistCountResult, wishlistRowsResult, followsCountResult, collectionsCountResult] =
    await Promise.all([
      supabase.from("wishlists").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("wishlists").select("product_id").eq("user_id", userId),
      supabase
        .from("seller_followers")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase.from("collections").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);

  const wishlistProductIds = Array.from(
    new Set(
      ((wishlistRowsResult.data || []) as Array<{ product_id: string }>).map((row) => row.product_id)
    )
  );

  if (wishlistProductIds.length === 0) {
    return {
      wishlistCount: wishlistCountResult.count || 0,
      followedSellerCount: followsCountResult.count || 0,
      ownedCollectionCount: collectionsCountResult.count || 0,
      relevantCollections: [],
    };
  }

  const collectionMatchesResult = await supabase
    .from("collection_items")
    .select("collection_id, product_id")
    .in("product_id", wishlistProductIds);

  const matchedCollectionIds = Array.from(
    new Set(
      ((collectionMatchesResult.data || []) as Array<{ collection_id: string }>).map(
        (row) => row.collection_id
      )
    )
  );

  if (matchedCollectionIds.length === 0) {
    return {
      wishlistCount: wishlistCountResult.count || 0,
      followedSellerCount: followsCountResult.count || 0,
      ownedCollectionCount: collectionsCountResult.count || 0,
      relevantCollections: [],
    };
  }

  const collectionsResult = await supabase
    .from("collections")
    .select("id, user_id, title, slug, description, updated_at")
    .in("id", matchedCollectionIds)
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .limit(6);

  const collections = ((collectionsResult.data || []) as CollectionRow[]).filter(
    (collection) => collection.user_id !== userId
  );
  const visibleCollectionIds = collections.map((collection) => collection.id);
  const ownerIds = Array.from(new Set(collections.map((collection) => collection.user_id)));

  const [collectionItemsResult, ownerProfilesResult] = await Promise.all([
    visibleCollectionIds.length > 0
      ? supabase
          .from("collection_items")
          .select("collection_id, product_id, sort_order, created_at, product:products(id, title, slug)")
          .in("collection_id", visibleCollectionIds)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as CollectionItemRow[] }),
    ownerIds.length > 0
      ? adminSupabase
          .from("profiles")
          .select("id, username, display_name, email")
          .in("id", ownerIds)
      : Promise.resolve({ data: [] as ProfileRow[] }),
  ]);

  const ownerById = new Map(
    ((ownerProfilesResult.data || []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );
  const matchingProductIdsByCollectionId = new Map<string, Set<string>>();
  ((collectionMatchesResult.data || []) as Array<{ collection_id: string; product_id: string }>).forEach(
    (row) => {
      const current = matchingProductIdsByCollectionId.get(row.collection_id) || new Set<string>();
      current.add(row.product_id);
      matchingProductIdsByCollectionId.set(row.collection_id, current);
    }
  );

  const previewProductsByCollectionId = new Map<
    string,
    Array<{ id: string; title: string; slug: string }>
  >();
  ((collectionItemsResult.data || []) as CollectionItemRow[]).forEach((item) => {
    const product = resolveProduct(item.product);
    if (!product) {
      return;
    }

    const current = previewProductsByCollectionId.get(item.collection_id) || [];
    if (current.length < 3) {
      current.push(product);
      previewProductsByCollectionId.set(item.collection_id, current);
    }
  });

  return {
    wishlistCount: wishlistCountResult.count || 0,
    followedSellerCount: followsCountResult.count || 0,
    ownedCollectionCount: collectionsCountResult.count || 0,
    relevantCollections: collections.map((collection) => ({
      id: collection.id,
      title: collection.title,
      slug: collection.slug,
      description: collection.description,
      updatedAt: collection.updated_at,
      ownerName: formatActor(ownerById.get(collection.user_id)),
      matchingWishlistCount: matchingProductIdsByCollectionId.get(collection.id)?.size || 0,
      previewProducts: previewProductsByCollectionId.get(collection.id) || [],
    })),
  };
}
