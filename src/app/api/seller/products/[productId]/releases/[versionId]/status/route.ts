import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { requireOwnedProductRouteUser } from "@/lib/auth/seller-route";
import { activateRelease, getOwnedVersionOrThrow, retireRelease } from "@/lib/seller/release-lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{
    productId: string;
    versionId: string;
  }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { productId, versionId } = await params;
  const access = await requireOwnedProductRouteUser(productId);

  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  const payload = (await request.json().catch(() => null)) as
    | { action?: "activate" | "retire"; reason?: string }
    | null;

  if (!payload?.action) {
    return NextResponse.json({ message: "Accion invalida." }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  try {
    const version = await getOwnedVersionOrThrow(adminSupabase, productId, versionId);

    if (payload.action === "activate") {
      if (version.release_status === "retired") {
        return NextResponse.json(
          { message: "Una release retirada no puede reactivarse." },
          { status: 409 }
        );
      }

      await activateRelease(adminSupabase, productId, versionId);

      await recordAuditLog({
        actorUserId: access.user.id,
        action: "product.release_activated",
        entityType: "product_version",
        entityId: versionId,
        metadata: {
          productId,
          version: version.version,
        },
      });

      return NextResponse.json({ message: "Release activada correctamente." });
    }

    const reason = payload.reason?.trim() || "seller_retired";
    await retireRelease(adminSupabase, productId, versionId, reason);

    await recordAuditLog({
      actorUserId: access.user.id,
      action: "product.release_retired",
      entityType: "product_version",
      entityId: versionId,
      metadata: {
        productId,
        version: version.version,
        reason,
      },
    });

    return NextResponse.json({ message: "Release retirada correctamente." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar el estado de la release.";
    return NextResponse.json({ message }, { status: 409 });
  }
}
