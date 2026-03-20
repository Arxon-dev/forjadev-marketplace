import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { requireOwnedProductRouteUser } from "@/lib/auth/seller-route";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadProductFile } from "@/lib/supabase/storage";

interface RouteContext {
  params: Promise<{
    productId: string;
  }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { productId } = await params;
  const access = await requireOwnedProductRouteUser(productId);

  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  const formData = await request.formData().catch(() => null);
  const version = String(formData?.get("version") || "").trim();
  const changelog = String(formData?.get("changelog") || "").trim();
  const releaseFile = formData?.get("file");

  if (!version) {
    return NextResponse.json({ message: "Debes indicar la version de la release." }, { status: 400 });
  }

  if (!(releaseFile instanceof File)) {
    return NextResponse.json({ message: "Debes adjuntar un ZIP para la release." }, { status: 400 });
  }

  const adminSupabase = createAdminClient();
  const versionsQuery = adminSupabase.from("product_versions") as any;
  const productsQuery = adminSupabase.from("products") as any;
  const productFilesQuery = adminSupabase.from("product_files") as any;

  const { data: pendingVersion } = await versionsQuery
    .select("id")
    .eq("product_id", productId)
    .eq("release_status", "pending")
    .limit(1)
    .maybeSingle();

  if (pendingVersion) {
    return NextResponse.json(
      { message: "Ya existe una release pendiente. Apruebala, retirala o sustituyela antes de subir otra." },
      { status: 409 }
    );
  }

  const { data: duplicatedVersion } = await versionsQuery
    .select("id")
    .eq("product_id", productId)
    .eq("version", version)
    .limit(1)
    .maybeSingle();

  if (duplicatedVersion) {
    return NextResponse.json({ message: "Ya existe una release con esa version." }, { status: 409 });
  }

  const { data: insertedVersion, error: versionError } = await versionsQuery
    .insert([
      {
        product_id: productId,
        version,
        changelog: changelog || null,
        release_status: "pending",
      },
    ])
    .select("id, version")
    .single();

  if (versionError || !insertedVersion) {
    return NextResponse.json({ message: "No se pudo crear la release." }, { status: 500 });
  }

  let uploadedFilePath: string | null = null;

  try {
    const uploadedFile = await uploadProductFile(
      adminSupabase,
      releaseFile,
      access.vendor.id,
      productId,
      insertedVersion.id
    );

    uploadedFilePath = uploadedFile.path;

    const { error: fileRecordError } = await productFilesQuery.insert([
      {
        product_version_id: insertedVersion.id,
        storage_path: uploadedFile.path,
        file_name: releaseFile.name,
        file_size_bytes: uploadedFile.size,
      },
    ]);

    if (fileRecordError) {
      throw fileRecordError;
    }
  } catch {
    if (uploadedFilePath) {
      await adminSupabase.storage.from("product-files").remove([uploadedFilePath]).catch(() => undefined);
    }

    await versionsQuery.delete().eq("id", insertedVersion.id);
    return NextResponse.json({ message: "No se pudo completar la subida del asset." }, { status: 500 });
  }

  const { error: productUpdateError } = await productsQuery
    .update({
      moderation_status:
        access.product.moderation_status === "approved" ? "approved" : "pending",
      rejection_reason: null,
    })
    .eq("id", productId);

  if (productUpdateError) {
    return NextResponse.json(
      { message: "La release se creo, pero no se pudo actualizar el estado del producto." },
      { status: 500 }
    );
  }

  await recordAuditLog({
    actorUserId: access.user.id,
    action: "product.release_submitted",
    entityType: "product_version",
    entityId: insertedVersion.id,
    metadata: {
      productId,
      version: insertedVersion.version,
    },
  });

  return NextResponse.json({
    message: "Release registrada correctamente",
    releaseId: insertedVersion.id,
  });
}
