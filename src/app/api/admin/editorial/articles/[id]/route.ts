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
import type { Database } from "@/types/database";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type HelpArticleRecord = Pick<
  Database["public"]["Tables"]["help_center_articles"]["Row"],
  | "category_id"
  | "article_type"
  | "audience"
  | "slug"
  | "title"
  | "summary"
  | "body"
  | "status"
  | "is_featured"
  | "sort_order"
  | "seo_title"
  | "seo_description"
  | "review_notes"
  | "related_product_id"
  | "published_at"
>;

type HelpCategoryStatusRecord = Pick<
  Database["public"]["Tables"]["help_center_categories"]["Row"],
  "status"
>;

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAdminRouteUser();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as Record<string, string | boolean | undefined> | null;
  const adminSupabase = createAdminClient();
  const adminArticles = adminSupabase.from("help_center_articles") as any;
  const adminCategories = adminSupabase.from("help_center_categories") as any;

  const { data: currentArticle } = await adminArticles
    .select("category_id, article_type, audience, slug, title, summary, body, status, is_featured, sort_order, seo_title, seo_description, review_notes, related_product_id, published_at")
    .eq("id", id)
    .maybeSingle();
  const currentArticleRecord = currentArticle as HelpArticleRecord | null;

  if (!currentArticleRecord) {
    return NextResponse.json({ message: "Articulo no encontrado." }, { status: 404 });
  }

  const nextStatus = normalizeEditorialStatus(String(payload?.status || currentArticleRecord.status));
  const nextInput = {
    title: String(payload?.title ?? currentArticleRecord.title).trim(),
    slug: String(payload?.slug ?? currentArticleRecord.slug).trim(),
    summary: String(payload?.summary ?? currentArticleRecord.summary ?? "").trim(),
    body: String(payload?.body ?? currentArticleRecord.body).trim(),
    categoryId: String(payload?.categoryId ?? currentArticleRecord.category_id),
    status: nextStatus,
  };

  const validationError = validateHelpArticleInput(nextInput);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  if (
    currentArticleRecord.status === "published" &&
    nextInput.slug !== currentArticleRecord.slug
  ) {
    return NextResponse.json(
      {
        message:
          "No puedes cambiar el slug de un articulo publicado sin retirarlo primero a draft o archived.",
      },
      { status: 409 }
    );
  }

  if (nextStatus === "published") {
    const { data: category } = await adminCategories.select("status").eq("id", nextInput.categoryId).maybeSingle();
    const categoryRecord = category as HelpCategoryStatusRecord | null;

    if (!categoryRecord || categoryRecord.status !== "published") {
      return NextResponse.json(
        { message: "No puedes publicar un articulo en una categoria que no este publicada." },
        { status: 409 }
      );
    }
  }

  const { data: existingArticle } = await adminArticles
    .select("id")
    .eq("slug", nextInput.slug)
    .neq("id", id)
    .maybeSingle();

  if (existingArticle) {
    return NextResponse.json({ message: "Ya existe un articulo con ese slug." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const shouldPublishNow = nextStatus === "published" && !currentArticleRecord.published_at;
  const { error } = await adminArticles
    .update({
      category_id: nextInput.categoryId,
      related_product_id:
        String(payload?.relatedProductId ?? currentArticleRecord.related_product_id ?? "").trim() ||
        null,
      article_type: normalizeHelpArticleType(
        String(payload?.articleType ?? currentArticleRecord.article_type)
      ),
      audience: normalizeEditorialAudience(String(payload?.audience ?? currentArticleRecord.audience)),
      slug: nextInput.slug,
      title: nextInput.title,
      summary: nextInput.summary || null,
      body: nextInput.body,
      status: nextStatus,
      is_featured:
        payload?.isFeatured !== undefined
          ? Boolean(payload.isFeatured)
          : currentArticleRecord.is_featured,
      sort_order: Number(payload?.sortOrder ?? currentArticleRecord.sort_order ?? 0),
      seo_title: String(payload?.seoTitle ?? currentArticleRecord.seo_title ?? "").trim() || null,
      seo_description:
        String(payload?.seoDescription ?? currentArticleRecord.seo_description ?? "").trim() || null,
      review_notes:
        String(payload?.reviewNotes ?? currentArticleRecord.review_notes ?? "").trim() || null,
      published_at: nextStatus === "published" ? currentArticleRecord.published_at || now : null,
      last_reviewed_at: nextStatus === "published" ? now : currentArticleRecord.published_at,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ message: error.message || "No se pudo actualizar el articulo." }, { status: 500 });
  }

  await recordAuditLog({
    actorUserId: auth.user.id,
    action: shouldPublishNow ? "editorial.article.published" : "editorial.article.updated",
    entityType: "help_center_article",
    entityId: id,
    metadata: { status: nextStatus },
  });

  return NextResponse.json({ id });
}
