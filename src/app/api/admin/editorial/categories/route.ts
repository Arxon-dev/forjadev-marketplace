import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminRouteUser } from "@/lib/auth/admin-route";
import { recordAuditLog } from "@/lib/audit";
import { validateCategoryInput } from "@/lib/editorial/admin";

export async function POST(request: Request) {
  const auth = await requireAdminRouteUser();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

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

  const input = {
    title: payload?.title?.trim() || "",
    slug: payload?.slug?.trim() || "",
  };
  const validationError = validateCategoryInput(input);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const adminCategories = adminSupabase.from("help_center_categories") as any;
  const { data: existingCategory } = await adminCategories.select("id").eq("slug", input.slug).maybeSingle();

  if (existingCategory) {
    return NextResponse.json({ message: "Ya existe una categoria con ese slug." }, { status: 409 });
  }

  const { data, error } = await adminCategories
    .insert([
      {
        title: input.title,
        slug: input.slug,
        description: payload?.description?.trim() || null,
        icon: payload?.icon?.trim() || null,
        sort_order: Number(payload?.sortOrder || 0),
        status: payload?.status || "draft",
        is_public: payload?.status === "published",
      },
    ])
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ message: error?.message || "No se pudo crear la categoria." }, { status: 500 });
  }

  await recordAuditLog({
    actorUserId: auth.user.id,
    action: "editorial.category.created",
    entityType: "help_center_category",
    entityId: data.id,
  });

  return NextResponse.json({ id: data.id });
}
