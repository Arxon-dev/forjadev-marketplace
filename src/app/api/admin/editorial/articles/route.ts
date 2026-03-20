import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminRouteUser } from "@/lib/auth/admin-route";
import { recordAuditLog } from "@/lib/audit";
import {
  normalizeEditorialAudience,
  normalizeEditorialStatus,
  normalizeHelpArticleType,
  validateHelpArticleInput,
} from "@/lib/editorial/admin";

export async function POST(request: Request) {
  const auth = await requireAdminRouteUser();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, string | boolean | undefined> | null;
  const status = normalizeEditorialStatus(String(payload?.status || "draft"));
  const input = {
    title: String(payload?.title || "").trim(),
    slug: String(payload?.slug || "").trim(),
    summary: String(payload?.summary || "").trim(),
    body: String(payload?.body || "").trim(),
    categoryId: String(payload?.categoryId || ""),
    status,
  };

  const validationError = validateHelpArticleInput(input);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const adminArticles = adminSupabase.from("help_center_articles") as any;
  const adminCategories = adminSupabase.from("help_center_categories") as any;
  if (status === "published") {
    const { data: category } = await adminCategories.select("status").eq("id", input.categoryId).maybeSingle();

    if (!category || category.status !== "published") {
      return NextResponse.json(
        { message: "No puedes publicar un articulo en una categoria que no este publicada." },
        { status: 409 }
      );
    }
  }

  const { data: existingArticle } = await adminArticles.select("id").eq("slug", input.slug).maybeSingle();

  if (existingArticle) {
    return NextResponse.json({ message: "Ya existe un articulo con ese slug." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data, error } = await adminArticles
    .insert([
      {
        category_id: input.categoryId,
        related_product_id: String(payload?.relatedProductId || "").trim() || null,
        article_type: normalizeHelpArticleType(String(payload?.articleType || "guide")),
        audience: normalizeEditorialAudience(String(payload?.audience || "buyer")),
        slug: input.slug,
        title: input.title,
        summary: input.summary || null,
        body: input.body,
        status,
        is_featured: Boolean(payload?.isFeatured),
        sort_order: Number(payload?.sortOrder || 0),
        seo_title: String(payload?.seoTitle || "").trim() || null,
        seo_description: String(payload?.seoDescription || "").trim() || null,
        review_notes: String(payload?.reviewNotes || "").trim() || null,
        published_at: status === "published" ? now : null,
        last_reviewed_at: status === "published" ? now : null,
        created_by_user_id: auth.user.id,
        updated_at: now,
      },
    ])
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ message: error?.message || "No se pudo crear el articulo." }, { status: 500 });
  }

  await recordAuditLog({
    actorUserId: auth.user.id,
    action: "editorial.article.created",
    entityType: "help_center_article",
    entityId: data.id,
    metadata: { status },
  });

  return NextResponse.json({ id: data.id });
}
