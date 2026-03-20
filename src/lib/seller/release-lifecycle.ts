import type { SupabaseClient } from "@supabase/supabase-js";

type AdminSupabase = SupabaseClient<any, "public", any>;

interface ProductVersionLifecycleRow {
  id: string;
  product_id: string;
  version: string;
  release_status: "pending" | "active" | "historical" | "retired";
  retired_reason: string | null;
}

export async function getOwnedVersionOrThrow(
  supabase: AdminSupabase,
  productId: string,
  versionId: string
) {
  const versionQuery = supabase.from("product_versions") as any;
  const { data: version, error } = await versionQuery
    .select("id, product_id, version, release_status, retired_reason")
    .eq("id", versionId)
    .eq("product_id", productId)
    .single();

  if (error || !version) {
    throw new Error("No se pudo resolver la release indicada.");
  }

  return version as ProductVersionLifecycleRow;
}

export async function versionHasAssets(
  supabase: AdminSupabase,
  versionId: string
): Promise<boolean> {
  const fileQuery = supabase.from("product_files") as any;
  const { data, error } = await fileQuery
    .select("id")
    .eq("product_version_id", versionId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("No se pudo verificar el asset de la release.");
  }

  return Boolean(data);
}

export async function activateRelease(
  supabase: AdminSupabase,
  productId: string,
  versionId: string
) {
  const hasAssets = await versionHasAssets(supabase, versionId);

  if (!hasAssets) {
    throw new Error("La release no puede activarse sin un ZIP asociado.");
  }

  const versionsQuery = supabase.from("product_versions") as any;

  const { error: historicalError } = await versionsQuery
    .update({
      release_status: "historical",
      retired_at: null,
      retired_reason: null,
    })
    .eq("product_id", productId)
    .eq("release_status", "active")
    .neq("id", versionId);

  if (historicalError) {
    throw new Error("No se pudo desactivar la release vigente.");
  }

  const { error: activateError } = await versionsQuery
    .update({
      release_status: "active",
      activated_at: new Date().toISOString(),
      retired_at: null,
      retired_reason: null,
    })
    .eq("id", versionId)
    .eq("product_id", productId);

  if (activateError) {
    throw new Error("No se pudo activar la release.");
  }
}

export async function retireRelease(
  supabase: AdminSupabase,
  productId: string,
  versionId: string,
  retiredReason: string
) {
  const version = await getOwnedVersionOrThrow(supabase, productId, versionId);

  if (version.release_status === "active") {
    throw new Error(
      "No puedes retirar la release activa directamente. Activa otra release o publica una nueva antes."
    );
  }

  const versionsQuery = supabase.from("product_versions") as any;
  const { error } = await versionsQuery
    .update({
      release_status: "retired",
      retired_at: new Date().toISOString(),
      retired_reason: retiredReason,
    })
    .eq("id", versionId)
    .eq("product_id", productId);

  if (error) {
    throw new Error("No se pudo retirar la release.");
  }
}
