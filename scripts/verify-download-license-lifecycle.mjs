import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Falta la variable ${name}`);
  }

  return value;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();

  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { response, body };
}

async function signInBuyer({ supabaseUrl, anonKey, email, password }) {
  const url = new URL("/auth/v1/token?grant_type=password", supabaseUrl);
  return requestJson(url, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
}

async function fetchRows({ supabaseUrl, path, token, apikey, params = {}, method = "GET", body }) {
  const url = new URL(path, supabaseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const { response, body: payload } = await requestJson(url, {
    method,
    headers: {
      apikey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${url.pathname}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function resolveDownloadExpectation({
  supabaseUrl,
  serviceRoleKey,
  buyerId,
  productId,
}) {
  const profileRows = await fetchRows({
    supabaseUrl,
    path: "/rest/v1/profiles",
    token: serviceRoleKey,
    apikey: serviceRoleKey,
    params: {
      select: "role",
      id: `eq.${buyerId}`,
    },
  });

  if (!Array.isArray(profileRows) || profileRows.length !== 1) {
    return { ok: false, message: "No se pudo verificar tu perfil" };
  }

  const productRows = await fetchRows({
    supabaseUrl,
    path: "/rest/v1/products",
    token: serviceRoleKey,
    apikey: serviceRoleKey,
    params: {
      select: "id,title,is_free,moderation_status,vendor_id",
      id: `eq.${productId}`,
    },
  });

  if (!Array.isArray(productRows) || productRows.length !== 1) {
    return { ok: false, message: "Producto no encontrado" };
  }

  const product = productRows[0];
  if (product.moderation_status !== "approved") {
    return { ok: false, message: "No tienes acceso a este producto" };
  }

  const purchaseRows = await fetchRows({
    supabaseUrl,
    path: "/rest/v1/order_items",
    token: serviceRoleKey,
    apikey: serviceRoleKey,
    params: {
      select: "id,product_id,order:orders!inner(id,status,user_id)",
      product_id: `eq.${productId}`,
      "order.user_id": `eq.${buyerId}`,
      "order.status": "eq.completed",
    },
  });

  if (!Array.isArray(purchaseRows) || purchaseRows.length === 0) {
    return { ok: false, message: "Necesitas comprar este producto antes de descargarlo" };
  }

  const licenseRows = await fetchRows({
    supabaseUrl,
    path: "/rest/v1/licenses",
    token: serviceRoleKey,
    apikey: serviceRoleKey,
    params: {
      select: "id,status",
      product_id: `eq.${productId}`,
      user_id: `eq.${buyerId}`,
    },
  });

  const hasAnyLicense = Array.isArray(licenseRows) && licenseRows.length > 0;
  const hasActiveLicense = hasAnyLicense && licenseRows.some((license) => license.status === "active");

  if (hasAnyLicense && !hasActiveLicense) {
    return { ok: false, message: "Tu licencia para este producto esta revocada" };
  }

  const versions = await fetchRows({
    supabaseUrl,
    path: "/rest/v1/product_versions",
    token: serviceRoleKey,
    apikey: serviceRoleKey,
    params: {
      select: "id,version,created_at",
      product_id: `eq.${productId}`,
      order: "created_at.desc",
    },
  });

  if (!Array.isArray(versions) || versions.length === 0) {
    return { ok: false, message: "Este producto aun no tiene versiones publicadas" };
  }

  const versionIds = versions.map((version) => version.id);
  const files = await fetchRows({
    supabaseUrl,
    path: "/rest/v1/product_files",
    token: serviceRoleKey,
    apikey: serviceRoleKey,
    params: {
      select: "id,product_version_id,storage_path,file_name,created_at",
      product_version_id: `in.(${versionIds.join(",")})`,
      order: "created_at.desc",
    },
  });

  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, message: "Ninguna version publicada tiene archivo asociado" };
  }

  return { ok: true, message: "Descarga permitida" };
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const qaEmail = requireEnv("MARKETPLACE_QA_EMAIL", "qa-buyer-3@forjadev.local");
  const qaPassword = requireEnv("MARKETPLACE_QA_PASSWORD", "ForjaDev_QA_2026!");

  const signInResult = await signInBuyer({
    supabaseUrl,
    anonKey,
    email: qaEmail,
    password: qaPassword,
  });

  if (!signInResult.response.ok || !signInResult.body?.access_token) {
    throw new Error("No se pudo autenticar el buyer QA para la verificacion de descarga");
  }

  const buyerToken = signInResult.body.access_token;
  const buyerId = signInResult.body.user.id;

  const licenses = await fetchRows({
    supabaseUrl,
    path: "/rest/v1/licenses",
    token: serviceRoleKey,
    apikey: serviceRoleKey,
    params: {
      select: "id,product_id,user_id,status,license_key",
      user_id: `eq.${buyerId}`,
      status: "eq.active",
      order: "issued_at.desc",
      limit: "1",
    },
  });

  if (!Array.isArray(licenses) || licenses.length !== 1) {
    throw new Error("No se encontro una licencia activa para el buyer QA");
  }

  const license = licenses[0];
  console.log(`Licencia objetivo: ${license.license_key} (${license.id})`);

  const allowedBefore = await resolveDownloadExpectation({
    supabaseUrl,
    serviceRoleKey,
    buyerId,
    productId: license.product_id,
  });

  if (!allowedBefore.ok) {
    throw new Error(`La descarga deberia estar permitida y no lo esta: ${allowedBefore.message}`);
  }

  console.log("Acceso con licencia activa: OK");

  const revoked = await fetchRows({
    supabaseUrl,
    path: "/rest/v1/licenses",
    token: serviceRoleKey,
    apikey: serviceRoleKey,
    method: "PATCH",
    params: {
      id: `eq.${license.id}`,
    },
    body: {
      status: "revoked",
      last_validated_at: new Date().toISOString(),
    },
  });

  if (!Array.isArray(revoked) || revoked.length !== 1 || revoked[0].status !== "revoked") {
    throw new Error("No se pudo revocar la licencia objetivo");
  }

  console.log("Revocacion aplicada");

  const blocked = await resolveDownloadExpectation({
    supabaseUrl,
    serviceRoleKey,
    buyerId,
    productId: license.product_id,
  });

  if (blocked.ok || blocked.message !== "Tu licencia para este producto esta revocada") {
    throw new Error("La descarga deberia estar bloqueada tras la revocacion");
  }

  console.log("Bloqueo por licencia revocada: OK");

  const reactivated = await fetchRows({
    supabaseUrl,
    path: "/rest/v1/licenses",
    token: serviceRoleKey,
    apikey: serviceRoleKey,
    method: "PATCH",
    params: {
      id: `eq.${license.id}`,
    },
    body: {
      status: "active",
      last_validated_at: new Date().toISOString(),
    },
  });

  if (!Array.isArray(reactivated) || reactivated.length !== 1 || reactivated[0].status !== "active") {
    throw new Error("No se pudo reactivar la licencia objetivo");
  }

  console.log("Reactivacion aplicada");

  const allowedAfter = await resolveDownloadExpectation({
    supabaseUrl,
    serviceRoleKey,
    buyerId,
    productId: license.product_id,
  });

  if (!allowedAfter.ok) {
    throw new Error(`La descarga deberia volver a estar permitida: ${allowedAfter.message}`);
  }

  console.log("Acceso restaurado tras reactivacion: OK");
  console.log("Verificacion de licencia y descarga completada correctamente");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
