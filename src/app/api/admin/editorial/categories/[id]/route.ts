import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminRouteUser } from "@/lib/auth/admin-route";
import { recordAuditLog } from "@/lib/audit";
import { validateCategoryInput } from "@/lib/editorial/admin";
import type { Database } from "@/types/database";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type HelpCategoryRecord = Pick<
  Database["public"]["Tables"]["help_center_categories"]["Row"],
  "title" | "slug" | "description" | "icon" | "sort_order" | "status"
>;

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAdminRouteUser();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as
    | {
        title?: string;
        slug?: string;
        description?: string;
        icon?: string;
        sortOrder?: string;
        status?: "draft" | "published" | "archived";
      }
    | null;

  const adminSupabase = createAdminClient();
  const adminCategories = adminSupabase.from("help_center_categories") as any;
  const adminArticles = adminSupabase.from("help_center_articles") as any;
  const { data: currentCategory } = await adminCategories
    .select("title, slug, description, icon, sort_order, status")
    .eq("id", id)
    .maybeSingle();
  const currentCategoryRecord = currentCategory as HelpCategoryRecord | null;

  if (!currentCategoryRecord) {
    return NextResponse.json({ message: "Categoria no encontrada." }, { status: 404 });
  }

  const input = {
    title: payload?.title?.trim() || currentCategoryRecord.title,
    slug: payload?.slug?.trim() || currentCategoryRecord.slug,
  };
  const validationError = validateCategoryInput(input);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  if (
    currentCategoryRecord.status === "published" &&
    input.slug !== currentCategoryRecord.slug
  ) {
    return NextResponse.json(
      {
        message:
          "No puedes cambiar el slug de una categoria publicada sin retirarla primero a draft o archived.",
      },
      { status: 409 }
    );
  }

  const { data: existingCategory } = await adminCategories
    .select("id")
    .eq("slug", input.slug)
    .neq("id", id)
    .maybeSingle();

  if (existingCategory) {
    return NextResponse.json({ message: "Ya existe una categoria con ese slug." }, { status: 409 });
  }

  const nextStatus = payload?.status || currentCategoryRecord.status;

  if (nextStatus !== "published" && currentCategoryRecord.status === "published") {
    const { count } = await adminArticles
      .select("*", { head: true, count: "exact" })
      .eq("category_id", id)
      .eq("status", "published");

    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          message:
            "No puedes retirar una categoria con articulos publicados activos. Pasa esos articulos a draft o archived primero.",
        },
        { status: 409 }
      );
    }
  }

  const { error } = await adminCategories
    .update({
      title: input.title,
      slug: input.slug,
      description: payload?.description?.trim() || currentCategoryRecord.description || null,
      icon: payload?.icon?.trim() || currentCategoryRecord.icon || null,
      sort_order: Number(payload?.sortOrder ?? currentCategoryRecord.sort_order ?? 0),
      status: nextStatus,
      is_public: nextStatus === "published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ message: error.message || "No se pudo actualizar la categoria." }, { status: 500 });
  }

  await recordAuditLog({
    actorUserId: auth.user.id,
    action: "editorial.category.updated",
    entityType: "help_center_category",
    entityId: id,
  });

  return NextResponse.json({ id });
}
