import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const projectRoot = process.cwd();
loadEnvFile(resolve(projectRoot, ".env.local"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan variables de entorno de Supabase para la QA buyer postpurchase.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.BUYER_POSTPURCHASE_QA_PORT || 3216);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const QA_PASSWORD = "ForjaDevQA!2026";
const BUYER_EMAIL = "qa-buyer-hub@forjadev.local";
const SELLER_EMAIL = "qa-buyer-hub-seller@forjadev.local";

function getCookieHeaderFromResponse(response) {
  const setCookies = response.headers.getSetCookie?.() || [];
  return setCookies.map((value) => value.split(";")[0]).join("; ");
}

async function request(pathname, options = {}) {
  return fetch(`${BASE_URL}${pathname}`, {
    redirect: "manual",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });
}

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/login`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("No se pudo iniciar el servidor local para la QA buyer postpurchase.");
}

async function startServer() {
  const child = spawn(process.execPath, ["qa-release-server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
    },
    stdio: "ignore",
  });

  await waitForServer();
  return child;
}

async function ensureUser({ email, password, role, displayName, username }) {
  const {
    data: { users },
    error: listError,
  } = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    throw listError;
  }

  let user = users.find((entry) => entry.email === email) || null;

  if (!user) {
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      throw error || new Error(`No se pudo crear ${email}`);
    }

    user = data.user;
  } else {
    const { error } = await adminSupabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });

    if (error) {
      throw error;
    }
  }

  const { data: existingProfile } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    const { error } = await adminSupabase
      .from("profiles")
      .update({
        email,
        username,
        display_name: displayName,
        role,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await adminSupabase.from("profiles").insert([
      {
        id: user.id,
        email,
        username,
        display_name: displayName,
        role,
      },
    ]);

    if (error) {
      throw error;
    }
  }

  return user;
}

async function ensureVendor(userId) {
  const { data: existingVendor } = await adminSupabase
    .from("vendors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingVendor) {
    return existingVendor;
  }

  const { data: vendor, error } = await adminSupabase
    .from("vendors")
    .insert([
      {
        user_id: userId,
        store_name: "QA Buyer Hub Store",
        slug: `qa-buyer-hub-${Date.now()}`,
        bio: "QA Buyer Hub Store",
      },
    ])
    .select("id")
    .single();

  if (error || !vendor) {
    throw error || new Error("No se pudo crear el vendor QA.");
  }

  return vendor;
}

async function uploadStorageZip({ vendorId, productId, versionId, fileName, contents }) {
  const filePath = `${vendorId}/${productId}/${versionId}/${fileName}`;
  const { error } = await adminSupabase.storage.from("product-files").upload(filePath, contents, {
    contentType: "application/zip",
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return filePath;
}

async function createApprovedProduct(vendorId, titlePrefix, slugPrefix) {
  const { data: product, error } = await adminSupabase
    .from("products")
    .insert([
      {
        vendor_id: vendorId,
        title: `${titlePrefix} ${Date.now()}`,
        slug: `${slugPrefix}-${Date.now()}`,
        short_description: "Producto QA buyer postpurchase.",
        description: "Producto QA buyer postpurchase.",
        price_cents: 2400,
        is_free: false,
        moderation_status: "approved",
      },
    ])
    .select("id, vendor_id, title, slug")
    .single();

  if (error || !product) {
    throw error || new Error("No se pudo crear el producto QA.");
  }

  const { data: version, error: versionError } = await adminSupabase
    .from("product_versions")
    .insert([
      {
        product_id: product.id,
        version: "1.0.0",
        changelog: "Release activa QA buyer postpurchase.",
        release_status: "active",
        activated_at: new Date().toISOString(),
      },
    ])
    .select("id")
    .single();

  if (versionError || !version) {
    throw versionError || new Error("No se pudo crear la version QA.");
  }

  const filePath = await uploadStorageZip({
    vendorId: product.vendor_id,
    productId: product.id,
    versionId: version.id,
    fileName: "qa-buyer-hub.zip",
    contents: Buffer.from("PK-QA-BUYER-HUB"),
  });

  const { error: fileError } = await adminSupabase.from("product_files").insert([
    {
      product_version_id: version.id,
      storage_path: filePath,
      file_name: "qa-buyer-hub.zip",
      file_size_bytes: Buffer.byteLength("PK-QA-BUYER-HUB"),
    },
  ]);

  if (fileError) {
    throw fileError;
  }

  return product;
}

async function createCompletedOrder({ buyerUserId, productId, totalCents, licenseStatus }) {
  const { data: order, error: orderError } = await adminSupabase
    .from("orders")
    .insert([
      {
        user_id: buyerUserId,
        total_cents: totalCents,
        currency: "EUR",
        status: "completed",
      },
    ])
    .select("id, created_at")
    .single();

  if (orderError || !order) {
    throw orderError || new Error("No se pudo crear la orden QA.");
  }

  const { data: orderItem, error: itemError } = await adminSupabase
    .from("order_items")
    .insert([
      {
        order_id: order.id,
        product_id: productId,
        price_cents: totalCents,
      },
    ])
    .select("id")
    .single();

  if (itemError || !orderItem) {
    throw itemError || new Error("No se pudo crear el order item QA.");
  }

  const { data: license, error: licenseError } = await adminSupabase
    .from("licenses")
    .insert([
      {
        order_item_id: orderItem.id,
        product_id: productId,
        user_id: buyerUserId,
        license_key: `QA-BUYER-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: licenseStatus,
      },
    ])
    .select("id")
    .single();

  if (licenseError || !license) {
    throw licenseError || new Error("No se pudo crear la licencia QA.");
  }

  return { order, orderItem, license };
}

async function login(identifier, password) {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`No se pudo iniciar sesion para ${identifier}: ${payload.error || response.status}`);
  }

  return getCookieHeaderFromResponse(response);
}

function recordCase(results, name, severity, passed, observed, difference = null) {
  results.push({
    name,
    severity,
    status: passed ? "PASS" : "FAIL",
    observed,
    difference,
  });
}

async function main() {
  const results = [];
  let server = null;

  try {
    server = await startServer();

    const buyerUser = await ensureUser({
      email: BUYER_EMAIL,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Buyer Hub",
      username: "qa_buyer_hub",
    });
    const sellerUser = await ensureUser({
      email: SELLER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Buyer Seller",
      username: "qa_buyer_seller",
    });

    const vendor = await ensureVendor(sellerUser.id);
    const activeProduct = await createApprovedProduct(vendor.id, "QA Active Product", "qa-active-product");
    const revokedProduct = await createApprovedProduct(vendor.id, "QA Revoked Product", "qa-revoked-product");
    const noPurchaseProduct = await createApprovedProduct(vendor.id, "QA Locked Product", "qa-locked-product");

    const activePurchase = await createCompletedOrder({
      buyerUserId: buyerUser.id,
      productId: activeProduct.id,
      totalCents: 2400,
      licenseStatus: "active",
    });
    await createCompletedOrder({
      buyerUserId: buyerUser.id,
      productId: revokedProduct.id,
      totalCents: 2400,
      licenseStatus: "revoked",
    });

    const { error: downloadSeedError } = await adminSupabase.from("downloads").insert([
      {
        user_id: buyerUser.id,
        product_id: activeProduct.id,
      },
    ]);

    if (downloadSeedError) {
      throw downloadSeedError;
    }

    const buyerCookie = await login(BUYER_EMAIL, QA_PASSWORD);

    const anonymousOrdersResponse = await request("/orders");
    recordCase(
      results,
      "anonimo_bloqueado_en_orders",
      "critical",
      anonymousOrdersResponse.status >= 300 &&
        anonymousOrdersResponse.status < 400 &&
        (anonymousOrdersResponse.headers.get("location") || "").includes("/login"),
      `status=${anonymousOrdersResponse.status}, location=${anonymousOrdersResponse.headers.get("location")}`,
      "Debe redirigir a /login"
    );

    const ordersResponse = await request(`/orders?highlightOrder=${activePurchase.order.id}`, {
      headers: { cookie: buyerCookie },
    });
    const ordersHtml = await ordersResponse.text();
    recordCase(
      results,
      "buyer_ve_hub_postcompra_con_pedido_resaltado",
      "critical",
      ordersResponse.status === 200 &&
        ordersHtml.includes("Compra completada correctamente.") &&
        ordersHtml.includes(activeProduct.title) &&
        ordersHtml.includes(revokedProduct.title),
      `status=${ordersResponse.status}`,
      "El hub debe renderizar la confirmacion y los items comprados"
    );

    recordCase(
      results,
      "buyer_ve_redescarga_soporte_y_licencias",
      "critical",
      ordersHtml.includes("Descargar de nuevo") &&
        ordersHtml.includes(`/support?product=${activeProduct.id}`) &&
        ordersHtml.includes("/licenses"),
      "HTML incluye acciones de postventa",
      "La continuidad buyer debe conectar descarga, soporte y licencias"
    );

    recordCase(
      results,
      "buyer_ve_bloqueo_por_licencia_revocada",
      "high",
      ordersHtml.includes("Licencia revocada") &&
        ordersHtml.includes("Tu licencia para este producto esta revocada"),
      "HTML incluye bloqueo y motivo de licencia revocada",
      "El buyer debe entender por que no puede descargar"
    );

    const allowedDownload = await request(`/api/download/${activeProduct.id}`, {
      headers: { cookie: buyerCookie },
    });
    const allowedPayload = await allowedDownload.json().catch(() => ({}));
    recordCase(
      results,
      "descarga_valida_para_producto_comprado",
      "critical",
      allowedDownload.status === 200 && Boolean(allowedPayload.url),
      `status=${allowedDownload.status}`,
      "La descarga activa debe devolver una URL firmada"
    );

    const redownload = await request(`/api/download/${activeProduct.id}`, {
      headers: { cookie: buyerCookie },
    });
    const redownloadPayload = await redownload.json().catch(() => ({}));
    recordCase(
      results,
      "redescarga_valida_para_producto_comprado",
      "critical",
      redownload.status === 200 && Boolean(redownloadPayload.url),
      `status=${redownload.status}`,
      "La redescarga debe seguir funcionando"
    );

    const revokedDownload = await request(`/api/download/${revokedProduct.id}`, {
      headers: { cookie: buyerCookie },
    });
    const revokedPayload = await revokedDownload.json().catch(() => ({}));
    recordCase(
      results,
      "descarga_bloqueada_por_licencia_revocada",
      "critical",
      revokedDownload.status === 403 &&
        revokedPayload.message === "Tu licencia para este producto esta revocada",
      `status=${revokedDownload.status}, message=${revokedPayload.message}`,
      "La API debe bloquear el acceso revocado"
    );

    const noPurchaseDownload = await request(`/api/download/${noPurchaseProduct.id}`, {
      headers: { cookie: buyerCookie },
    });
    const noPurchasePayload = await noPurchaseDownload.json().catch(() => ({}));
    recordCase(
      results,
      "descarga_bloqueada_sin_compra",
      "critical",
      noPurchaseDownload.status === 403 &&
        noPurchasePayload.message === "Necesitas comprar este producto antes de descargarlo",
      `status=${noPurchaseDownload.status}, message=${noPurchasePayload.message}`,
      "La API debe bloquear productos no comprados"
    );

    const failed = results.filter((test) => test.status === "FAIL");
    console.log(
      JSON.stringify(
        {
          executedAt: new Date().toISOString(),
          total: results.length,
          passed: results.length - failed.length,
          failed: failed.length,
          results,
        },
        null,
        2
      )
    );

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  const serializedError =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : typeof error === "object" && error !== null
        ? JSON.parse(JSON.stringify(error))
        : { message: String(error) };

  console.error(JSON.stringify({ fatal: true, error: serializedError }, null, 2));
  process.exit(1);
});
