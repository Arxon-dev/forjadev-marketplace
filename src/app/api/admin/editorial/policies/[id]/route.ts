import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminRouteUser } from "@/lib/auth/admin-route";
import { recordAuditLog } from "@/lib/audit";
import {
  normalizeEditorialAudience,
  normalizeEditorialStatus,
  validatePolicyInput,
} from "@/lib/editorial/admin";
import type { Database } from "@/types/database";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type PolicyRecord = Pick<
  Database["public"]["Tables"]["marketplace_policy_pages"]["Row"],
  | "policy_key"
  | "title"
  | "summary"
  | "body"
  | "audience"
  | "status"
  | "sort_order"
  | "seo_title"
  | "seo_description"
  | "review_notes"
  | "published_at"
>;

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAdminRouteUser();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as Record<string, string | undefined> | null;
  const adminSupabase = createAdminClient();
  const adminPolicies = adminSupabase.from("marketplace_policy_pages") as any;

  const { data: currentPolicy } = await adminPolicies
    .select("policy_key, title, summary, body, audience, status, sort_order, seo_title, seo_description, review_notes, published_at")
    .eq("id", id)
    .maybeSingle();
  const currentPolicyRecord = currentPolicy as PolicyRecord | null;

  if (!currentPolicyRecord) {
    return NextResponse.json({ message: "Policy no encontrada." }, { status: 404 });
  }

  const nextStatus = normalizeEditorialStatus(String(payload?.status || currentPolicyRecord.status));
  const input = {
    title: String(payload?.title ?? currentPolicyRecord.title).trim(),
    policyKey: String(payload?.policyKey ?? currentPolicyRecord.policy_key).trim(),
    summary: String(payload?.summary ?? currentPolicyRecord.summary ?? "").trim(),
    body: String(payload?.body ?? currentPolicyRecord.body).trim(),
    status: nextStatus,
  };

  const validationError = validatePolicyInput(input);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  if (
    currentPolicyRecord.status === "published" &&
    input.policyKey !== currentPolicyRecord.policy_key
  ) {
    return NextResponse.json(
      {
        message:
          "No puedes cambiar la clave publica de una policy publicada sin retirarla primero a draft o archived.",
      },
      { status: 409 }
    );
  }

  const { data: existingPolicy } = await adminPolicies
    .select("id")
    .eq("policy_key", input.policyKey)
    .neq("id", id)
    .maybeSingle();

  if (existingPolicy) {
    return NextResponse.json({ message: "Ya existe una policy con esa clave publica." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const shouldPublishNow = nextStatus === "published" && !currentPolicyRecord.published_at;
  const { error } = await adminPolicies
    .update({
      policy_key: input.policyKey,
      title: input.title,
      summary: input.summary || null,
      body: input.body,
      audience: normalizeEditorialAudience(String(payload?.audience ?? currentPolicyRecord.audience)),
      status: nextStatus,
      sort_order: Number(payload?.sortOrder ?? currentPolicyRecord.sort_order ?? 0),
      seo_title: String(payload?.seoTitle ?? currentPolicyRecord.seo_title ?? "").trim() || null,
      seo_description:
        String(payload?.seoDescription ?? currentPolicyRecord.seo_description ?? "").trim() || null,
      review_notes:
        String(payload?.reviewNotes ?? currentPolicyRecord.review_notes ?? "").trim() || null,
      published_at: nextStatus === "published" ? currentPolicyRecord.published_at || now : null,
      last_reviewed_at: nextStatus === "published" ? now : currentPolicyRecord.published_at,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ message: error.message || "No se pudo actualizar la policy." }, { status: 500 });
  }

  await recordAuditLog({
    actorUserId: auth.user.id,
    action: shouldPublishNow ? "editorial.policy.published" : "editorial.policy.updated",
    entityType: "marketplace_policy",
    entityId: id,
    metadata: { status: nextStatus },
  });

  return NextResponse.json({ id });
}
