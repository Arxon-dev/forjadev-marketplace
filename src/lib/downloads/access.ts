import type { SupabaseClient } from "@supabase/supabase-js";

type ProductRow = {
  id: string;
  title: string;
  is_free: boolean;
  moderation_status: string;
  vendor_id: string;
};

type VendorRow = {
  user_id: string;
};

type ProfileRow = {
  role: "buyer" | "seller" | "admin";
};

type ProductVersionRow = {
  id: string;
  version: string;
  created_at: string;
  release_status: "pending" | "active" | "historical" | "retired";
};

type ProductFileRow = {
  id: string;
  product_version_id: string;
  storage_path: string;
  file_name: string;
  created_at: string;
};

export type DownloadAccessResult =
  | {
      ok: true;
      product: ProductRow;
      file: ProductFileRow;
      version: ProductVersionRow;
      isOwner: boolean;
      isAdmin: boolean;
      hasPurchase: boolean;
    }
  | {
      ok: false;
      status: 403 | 404 | 409;
      message: string;
    };

export async function resolveDownloadAccess(
  supabase: SupabaseClient,
  userId: string,
  productId: string
): Promise<DownloadAccessResult> {
  // This helper is meant for trusted server-side callers using a privileged
  // client plus explicit userId checks before exposing file information.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single<ProfileRow>();

  if (profileError || !profile) {
    return {
      ok: false,
      status: 403,
      message: "No se pudo verificar tu perfil",
    };
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, title, is_free, moderation_status, vendor_id")
    .eq("id", productId)
    .single<ProductRow>();

  if (productError || !product) {
    return {
      ok: false,
      status: 404,
      message: "Producto no encontrado",
    };
  }

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("user_id")
    .eq("id", product.vendor_id)
    .single<VendorRow>();

  if (vendorError || !vendor) {
    return {
      ok: false,
      status: 404,
      message: "No se pudo resolver el propietario del producto",
    };
  }

  const isAdmin = profile.role === "admin";
  const isOwner = vendor.user_id === userId;

  if (!isAdmin && !isOwner && product.moderation_status !== "approved") {
    return {
      ok: false,
      status: 403,
      message: "No tienes acceso a este producto",
    };
  }

  let hasPurchase = false;
  let hasActiveLicense = false;
  let hasAnyLicense = false;

  if (!product.is_free && !isAdmin && !isOwner) {
    const { data: purchase, error: purchaseError } = await supabase
      .from("order_items")
      .select("id, order:orders!inner(status, user_id)")
      .eq("product_id", productId)
      .eq("order.user_id", userId)
      .eq("order.status", "completed")
      .limit(1)
      .maybeSingle();

    if (purchaseError) {
      return {
        ok: false,
        status: 403,
        message: "No se pudo verificar tu compra",
      };
    }

    hasPurchase = Boolean(purchase);

    if (!hasPurchase) {
      return {
        ok: false,
        status: 403,
        message: "Necesitas comprar este producto antes de descargarlo",
      };
    }

    const { data: licenses, error: licenseError } = await supabase
      .from("licenses")
      .select("id, status")
      .eq("product_id", productId)
      .eq("user_id", userId);

    if (licenseError) {
      return {
        ok: false,
        status: 403,
        message: "No se pudo verificar el estado de tu licencia",
      };
    }

    hasAnyLicense = Boolean(licenses && licenses.length > 0);
    hasActiveLicense = Boolean(
      licenses && licenses.some((license) => license.status === "active")
    );

    if (hasAnyLicense && !hasActiveLicense) {
      return {
        ok: false,
        status: 403,
        message: "Tu licencia para este producto esta revocada",
      };
    }
  }

  const { data: versions, error: versionError } = await supabase
    .from("product_versions")
    .select("id, version, created_at, release_status")
    .eq("product_id", productId)
    .eq("release_status", "active")
    .returns<ProductVersionRow[]>();

  if (versionError) {
    return {
      ok: false,
      status: 409,
      message: "No se pudo resolver la version descargable",
    };
  }

  if (!versions || versions.length === 0) {
    return {
      ok: false,
      status: 409,
      message: "Este producto aun no tiene una release activa disponible",
    };
  }

  const versionIds = versions.map((version) => version.id);

  const { data: files, error: fileError } = await supabase
    .from("product_files")
    .select("id, product_version_id, storage_path, file_name, created_at")
    .in("product_version_id", versionIds)
    .order("created_at", { ascending: false })
    .returns<ProductFileRow[]>();

  if (fileError) {
    return {
      ok: false,
      status: 409,
      message: "No se pudo resolver el archivo descargable",
    };
  }

  if (!files || files.length === 0) {
    return {
      ok: false,
      status: 409,
      message: "Ninguna version publicada tiene archivo asociado",
    };
  }

  const latestVersionWithFile = versions.find((version) =>
    files.some((file) => file.product_version_id === version.id)
  );

  if (!latestVersionWithFile) {
    return {
      ok: false,
      status: 409,
      message: "Ninguna version publicada tiene archivo asociado",
    };
  }

  const file = files.find((currentFile) => currentFile.product_version_id === latestVersionWithFile.id);

  if (!file) {
    return {
      ok: false,
      status: 409,
      message: "Ninguna version publicada tiene archivo asociado",
    };
  }

  return {
    ok: true,
    product,
    version: latestVersionWithFile,
    file,
    isOwner,
    isAdmin,
    hasPurchase:
      product.is_free || !hasAnyLicense
        ? true
        : hasActiveLicense || isAdmin || isOwner || hasPurchase,
  };
}
