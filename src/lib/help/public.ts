import type { Database } from "@/types/database";

type SupabaseClientLike = {
  from: (table: string) => any;
};

type HelpCategoryRow = Database["public"]["Tables"]["help_center_categories"]["Row"];
type HelpArticleRow = Database["public"]["Tables"]["help_center_articles"]["Row"];
type PolicyPageRow = Database["public"]["Tables"]["marketplace_policy_pages"]["Row"];

export type HelpCategory = Pick<
  HelpCategoryRow,
  "id" | "slug" | "title" | "description" | "icon" | "sort_order"
>;

export type HelpArticleListItem = Pick<
  HelpArticleRow,
  | "id"
  | "slug"
  | "title"
  | "summary"
  | "article_type"
  | "audience"
  | "published_at"
  | "updated_at"
  | "sort_order"
> & {
  category: HelpCategory;
  relatedProduct: {
    id: string;
    title: string;
    slug: string;
  } | null;
};

export type HelpArticleDetail = HelpArticleListItem & {
  body: string;
};

export type PolicyListItem = Pick<
  PolicyPageRow,
  "id" | "policy_key" | "title" | "summary" | "audience" | "published_at" | "updated_at" | "sort_order"
>;

export type PolicyDetail = PolicyListItem & {
  body: string;
};

export interface ProductCommerceHelpContext {
  articles: HelpArticleListItem[];
  policies: PolicyListItem[];
}

function normalizeArticleItems(rawItems: any[]): HelpArticleListItem[] {
  return rawItems.map((item) => {
    const category = Array.isArray(item.category) ? item.category[0] : item.category;
    const relatedProduct = Array.isArray(item.relatedProduct)
      ? item.relatedProduct[0]
      : item.relatedProduct;

    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      article_type: item.article_type,
      audience: item.audience,
      published_at: item.published_at,
      updated_at: item.updated_at,
      sort_order: item.sort_order,
      category,
      relatedProduct: relatedProduct || null,
    };
  });
}

export async function getPublicHelpCategories(
  supabase: SupabaseClientLike
): Promise<HelpCategory[]> {
  const { data } = await supabase
    .from("help_center_categories")
    .select("id, slug, title, description, icon, sort_order")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  return (data || []) as HelpCategory[];
}

export async function getFeaturedHelpArticles(
  supabase: SupabaseClientLike,
  limit = 6
): Promise<HelpArticleListItem[]> {
  const { data } = await supabase
    .from("help_center_articles")
    .select(
      "id, slug, title, summary, article_type, audience, published_at, updated_at, sort_order, category:help_center_categories(id, slug, title, description, icon, sort_order), relatedProduct:products(id, title, slug)"
    )
    .eq("status", "published")
    .eq("is_featured", true)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false })
    .limit(limit);

  return normalizeArticleItems(data || []);
}

export async function getHelpCategoryBySlug(
  supabase: SupabaseClientLike,
  slug: string
): Promise<HelpCategory | null> {
  const { data } = await supabase
    .from("help_center_categories")
    .select("id, slug, title, description, icon, sort_order")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  return (data as HelpCategory | null) || null;
}

export async function getHelpArticlesByCategory(
  supabase: SupabaseClientLike,
  categoryId: string
): Promise<HelpArticleListItem[]> {
  const { data } = await supabase
    .from("help_center_articles")
    .select(
      "id, slug, title, summary, article_type, audience, published_at, updated_at, sort_order, category:help_center_categories(id, slug, title, description, icon, sort_order), relatedProduct:products(id, title, slug)"
    )
    .eq("status", "published")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false });

  return normalizeArticleItems(data || []);
}

export async function getHelpArticleBySlug(
  supabase: SupabaseClientLike,
  slug: string
): Promise<HelpArticleDetail | null> {
  const { data } = await supabase
    .from("help_center_articles")
    .select(
      "id, slug, title, summary, body, article_type, audience, published_at, updated_at, sort_order, category:help_center_categories(id, slug, title, description, icon, sort_order), relatedProduct:products(id, title, slug)"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!data) {
    return null;
  }

  const normalized = normalizeArticleItems([data])[0];

  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    body: (data as { body: string }).body,
  };
}

export async function getRelatedHelpArticles(
  supabase: SupabaseClientLike,
  categoryId: string,
  excludeArticleId: string,
  limit = 4
): Promise<HelpArticleListItem[]> {
  const { data } = await supabase
    .from("help_center_articles")
    .select(
      "id, slug, title, summary, article_type, audience, published_at, updated_at, sort_order, category:help_center_categories(id, slug, title, description, icon, sort_order), relatedProduct:products(id, title, slug)"
    )
    .eq("status", "published")
    .eq("category_id", categoryId)
    .neq("id", excludeArticleId)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false })
    .limit(limit);

  return normalizeArticleItems(data || []);
}

export async function getPublicPolicies(
  supabase: SupabaseClientLike
): Promise<PolicyListItem[]> {
  const { data } = await supabase
    .from("marketplace_policy_pages")
    .select("id, policy_key, title, summary, audience, published_at, updated_at, sort_order")
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false });

  return (data || []) as PolicyListItem[];
}

export async function getPublicPolicyByKey(
  supabase: SupabaseClientLike,
  policyKey: string
): Promise<PolicyDetail | null> {
  const { data } = await supabase
    .from("marketplace_policy_pages")
    .select(
      "id, policy_key, title, summary, body, audience, published_at, updated_at, sort_order"
    )
    .eq("policy_key", policyKey)
    .eq("status", "published")
    .maybeSingle();

  return (data as PolicyDetail | null) || null;
}

export async function getProductCommerceHelpContext(
  supabase: SupabaseClientLike,
  productId: string,
  articleLimit = 2,
  policyLimit = 2
): Promise<ProductCommerceHelpContext | null> {
  const [relatedArticlesResult, featuredArticlesResult, policiesResult] = await Promise.all([
    supabase
      .from("help_center_articles")
      .select(
        "id, slug, title, summary, article_type, audience, published_at, updated_at, sort_order, category:help_center_categories(id, slug, title, description, icon, sort_order), relatedProduct:products(id, title, slug)"
      )
      .eq("status", "published")
      .eq("related_product_id", productId)
      .in("audience", ["buyer", "shared"])
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(articleLimit),
    supabase
      .from("help_center_articles")
      .select(
        "id, slug, title, summary, article_type, audience, published_at, updated_at, sort_order, category:help_center_categories(id, slug, title, description, icon, sort_order), relatedProduct:products(id, title, slug)"
      )
      .eq("status", "published")
      .eq("is_featured", true)
      .in("audience", ["buyer", "shared"])
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(Math.max(articleLimit, 4)),
    supabase
      .from("marketplace_policy_pages")
      .select("id, policy_key, title, summary, audience, published_at, updated_at, sort_order")
      .eq("status", "published")
      .in("audience", ["buyer", "shared"])
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false })
      .limit(policyLimit),
  ]);

  const directArticles = normalizeArticleItems(relatedArticlesResult.data || []);
  const featuredArticles = normalizeArticleItems(featuredArticlesResult.data || []);
  const articleById = new Map<string, HelpArticleListItem>();

  for (const article of [...directArticles, ...featuredArticles]) {
    if (!articleById.has(article.id)) {
      articleById.set(article.id, article);
    }
  }

  const articles = Array.from(articleById.values()).slice(0, articleLimit);
  const policies = (policiesResult.data || []) as PolicyListItem[];

  if (articles.length === 0 && policies.length === 0) {
    return null;
  }

  return {
    articles,
    policies,
  };
}
