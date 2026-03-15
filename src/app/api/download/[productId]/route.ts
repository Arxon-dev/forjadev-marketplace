import { NextResponse } from "next/server";
import { recordAuditLog } from "@/lib/audit";
import { resolveDownloadAccess } from "@/lib/downloads/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSignedDownloadUrl } from "@/lib/supabase/storage";

interface RouteContext {
  params: Promise<{
    productId: string;
  }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { productId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Necesitas iniciar sesión" }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const access = await resolveDownloadAccess(adminSupabase, user.id, productId);

    if (!access.ok) {
      return NextResponse.json({ message: access.message }, { status: access.status });
    }

    let url: string;

    try {
      url = await getSignedDownloadUrl(adminSupabase, access.file.storage_path, 60);
    } catch {
      return NextResponse.json(
        { message: "El archivo de descarga no existe en Storage o no está disponible" },
        { status: 409 }
      );
    }

    const { error: downloadError } = await supabase.from("downloads").insert([
      {
        user_id: user.id,
        product_id: access.product.id,
      },
    ]);

    if (downloadError) {
      return NextResponse.json(
        { message: "No se pudo registrar la descarga" },
        { status: 500 }
      );
    }

    await recordAuditLog({
      actorUserId: user.id,
      action: "download.generated",
      entityType: "product",
      entityId: access.product.id,
      metadata: {
        version_id: access.version.id,
        file_id: access.file.id,
        owner_access: access.isOwner,
        admin_access: access.isAdmin,
      },
    });

    return NextResponse.json({ url, expiresIn: 60 });
  } catch {
    return NextResponse.json(
      { message: "Ocurrió un error inesperado al preparar la descarga" },
      { status: 500 }
    );
  }
}
