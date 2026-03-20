import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminRouteUser } from "@/lib/auth/admin-route";
import { recordAuditLog } from "@/lib/audit";
import {
  normalizeEditorialAudience,
  normalizeEditorialStatus,
  validatePolicyInput,
} from "@/lib/editorial/admin";

export async function POST(request: Request) {
  const auth = await requireAdminRouteUser();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, string | undefined> | null;
  const status = normalizeEditorialStatus(String(payload?.status || "draft"));
  const input = {
    title: String(payload?.title || "").trim(),
    policyKey: String(payload?.policyKey || "").trim(),
    summary: String(payload?.summary || "").trim(),
    body: String(payload?.body || "").trim(),
    status,
  };

  const validationError = validatePolicyInput(input);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const adminPolicies = adminSupabase.from("marketplace_policy_pages") as any;
  const { data: existingPolicy } = await adminPolicies
    .select("id")
    .eq("policy_key", input.policyKey)
    .maybeSingle();

  if (existingPolicy) {
    return NextResponse.json({ message: "Ya existe una policy con esa clave publica." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data, error } = await adminPolicies
    .insert([
      {
        policy_key: input.policyKey,
        title: input.title,
        summary: input.summary || null,
        body: input.body,
        audience: normalizeEditorialAudience(String(payload?.audience || "shared")),
        status,
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
    return NextResponse.json({ message: error?.message || "No se pudo crear la policy." }, { status: 500 });
  }

  await recordAuditLog({
    actorUserId: auth.user.id,
    action: "editorial.policy.created",
    entityType: "marketplace_policy",
    entityId: data.id,
    metadata: { status },
  });

  return NextResponse.json({ id: data.id });
}
