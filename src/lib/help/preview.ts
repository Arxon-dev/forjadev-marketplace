import type { Database } from "@/types/database";
import type { HelpArticleDetail, HelpArticleListItem, HelpCategory, PolicyDetail, PolicyListItem } from "./public";

type SupabaseClientLike = {
  from: (table: string) => any;
};

type HelpCategoryRow = Database["public"]["Tables"]["help_center_categories"]["Row"];
type HelpArticleRow = Database["public"]["Tables"]["help_center_articles"]["Row"];
type PolicyRow = Database["public"]["Tables"]["marketplace_policy_pages"]["Row"];

export type PreviewCategory = HelpCategory & Pick<HelpCategoryRow, "status">;
export type PreviewArticle = HelpArticleDetail & Pick<HelpArticleRow, "status">;
export type PreviewPolicy = PolicyDetail & Pick<PolicyRow, "status">;

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

export async function getPreviewHelpCategoryById(
  supabase: SupabaseClientLike,
  id: string
): Promise<PreviewCategory | null> {
  const { data } = await supabase
    .from("help_center_categories")
    .select("id, slug, title, description, icon, sort_order, status")
    .eq("id", id)
    .maybeSingle();

  return (data as PreviewCategory | null) || null;
}

export async function getPreviewArticlesByCategory(
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

export async function getPreviewArticleById(
  supabase: SupabaseClientLike,
  id: string
): Promise<PreviewArticle | null> {
  const { data } = await supabase
    .from("help_center_articles")
    .select(
      "id, slug, title, summary, body, article_type, audience, published_at, updated_at, sort_order, status, category:help_center_categories(id, slug, title, description, icon, sort_order), relatedProduct:products(id, title, slug)"
    )
    .eq("id", id)
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
    status: (data as { status: PreviewArticle["status"] }).status,
  };
}

export async function getPreviewRelatedArticles(
  supabase: SupabaseClientLike,
  categoryId: string,
  excludeArticleId: string
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
    .limit(4);

  return normalizeArticleItems(data || []);
}

export async function getPreviewPolicyById(
  supabase: SupabaseClientLike,
  id: string
): Promise<PreviewPolicy | null> {
  const { data } = await supabase
    .from("marketplace_policy_pages")
    .select(
      "id, policy_key, title, summary, body, audience, published_at, updated_at, sort_order, status"
    )
    .eq("id", id)
    .maybeSingle();

  return (data as PreviewPolicy | null) || null;
}

export async function getPreviewRelatedPolicies(
  supabase: SupabaseClientLike,
  excludePolicyId: string
): Promise<PolicyListItem[]> {
  const { data } = await supabase
    .from("marketplace_policy_pages")
    .select("id, policy_key, title, summary, audience, published_at, updated_at, sort_order")
    .eq("status", "published")
    .neq("id", excludePolicyId)
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false })
    .limit(4);

  return (data || []) as PolicyListItem[];
}

export async function getPreviewPolicies(
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
