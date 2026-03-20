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
  throw new Error("Faltan variables de entorno de Supabase para la QA comercial por producto.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.PRODUCT_PROMOTIONS_QA_PORT || 3215);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const QA_PASSWORD = "ForjaDevQA!2026";
const OWNER_EMAIL = "qa-promotions-owner@forjadev.local";
const OTHER_SELLER_EMAIL = "qa-promotions-other@forjadev.local";
const BUYER_EMAIL = "qa-promotions-buyer@forjadev.local";

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

  throw new Error("No se pudo iniciar el servidor local para la QA comercial por producto.");
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

async function ensureVendor(userId, slugPrefix, storeName) {
  const { data: existingVendor } = await adminSupabase
    .from("vendors")
    .select("id, slug")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingVendor) {
    return existingVendor;
  }

  const { data: insertedVendor, error } = await adminSupabase
    .from("vendors")
    .insert([
      {
        user_id: userId,
        store_name: storeName,
        slug: `${slugPrefix}-${Date.now()}`,
        bio: `${storeName} QA`,
      },
    ])
    .select("id, slug")
    .single();

  if (error || !insertedVendor) {
    throw error || new Error(`No se pudo crear vendor para ${storeName}`);
  }

  return insertedVendor;
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

async function setupProduct({ ownerVendorId, slugPrefix, titlePrefix }) {
  const { data: product, error: productError } = await adminSupabase
    .from("products")
    .insert([
      {
        vendor_id: ownerVendorId,
        title: `${titlePrefix} ${slugPrefix}`,
        slug: `${slugPrefix}-${Date.now()}`,
        short_description: "Producto QA para promociones por producto.",
        description: "Producto QA para validar campanas y cupones por producto.",
        price_cents: 2900,
        is_free: false,
        moderation_status: "approved",
      },
    ])
    .select("id, vendor_id, title, slug")
    .single();

  if (productError || !product) {
    throw productError || new Error("No se pudo crear el producto QA.");
  }

  const { data: version, error: versionError } = await adminSupabase
    .from("product_versions")
    .insert([
      {
        product_id: product.id,
        version: "1.0.0",
        changelog: "Release activa QA para promociones.",
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
    fileName: "qa-promotions-active.zip",
    contents: Buffer.from("PK-QA-PROMOTIONS"),
  });

  const { error: fileError } = await adminSupabase.from("product_files").insert([
    {
      product_version_id: version.id,
      storage_path: filePath,
      file_name: "qa-promotions-active.zip",
      file_size_bytes: Buffer.byteLength("PK-QA-PROMOTIONS"),
    },
  ]);

  if (fileError) {
    throw fileError;
  }

  const day = new Date().toISOString().slice(0, 10);
  const { error: analyticsError } = await adminSupabase.from("product_analytics_daily").upsert(
    [
      {
        product_id: product.id,
        vendor_id: ownerVendorId,
        day,
        view_count: 42,
        click_count: 0,
        add_to_cart_count: 0,
        purchase_count: 3,
        download_count: 2,
        revenue_cents: 5800,
      },
    ],
    { onConflict: "product_id,day" }
  );

  if (analyticsError) {
    throw analyticsError;
  }

  return product;
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

async function postJson(pathname, cookieHeader, body) {
  const response = await request(pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: cookieHeader,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
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

    const ownerUser = await ensureUser({
      email: OWNER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Promotions Owner",
      username: "qa_promotions_owner",
    });
    const otherSellerUser = await ensureUser({
      email: OTHER_SELLER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Promotions Other Seller",
      username: "qa_promotions_other",
    });
    const buyerUser = await ensureUser({
      email: BUYER_EMAIL,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Promotions Buyer",
      username: "qa_promotions_buyer",
    });

    const ownerVendor = await ensureVendor(
      ownerUser.id,
      "qa-promotions-owner-store",
      "QA Promotions Owner Store"
    );
    await ensureVendor(otherSellerUser.id, "qa-promotions-other-store", "QA Promotions Other Store");

    const product = await setupProduct({
      ownerVendorId: ownerVendor.id,
      slugPrefix: "qa-product-promotions",
      titlePrefix: "QA Product Promotions",
    });
    const emptyProduct = await setupProduct({
      ownerVendorId: ownerVendor.id,
      slugPrefix: "qa-product-promotions-empty",
      titlePrefix: "QA Product Promotions Empty",
    });

    const ownerCookie = await login(OWNER_EMAIL, QA_PASSWORD);
    const otherSellerCookie = await login(OTHER_SELLER_EMAIL, QA_PASSWORD);
    const buyerCookie = await login(BUYER_EMAIL, QA_PASSWORD);

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const currentStart = new Date(now - oneHour).toISOString();
    const currentEnd = new Date(now + oneHour).toISOString();
    const pastStart = new Date(now - 3 * oneHour).toISOString();
    const pastEnd = new Date(now - 2 * oneHour).toISOString();

    const campaignCreate = await postJson(
      `/api/seller/products/${product.id}/campaigns`,
      ownerCookie,
      {
        title: "QA Campaign Vigente",
        campaignType: "flash_deal",
        discountType: "percent",
        discountValue: 15,
        startsAt: currentStart,
        endsAt: currentEnd,
        isActive: true,
      }
    );

    const inactiveCampaignCreate = await postJson(
      `/api/seller/products/${product.id}/campaigns`,
      ownerCookie,
      {
        title: "QA Campaign Inactiva",
        campaignType: "launch_discount",
        discountType: "fixed",
        discountValue: 3.5,
        startsAt: currentStart,
        endsAt: currentEnd,
        isActive: false,
      }
    );

    const couponCode = `QAPROMO${String(Date.now()).slice(-6)}`;
    const expiredCouponCode = `QAOLD${String(Date.now()).slice(-6)}`;

    const couponCreate = await postJson(
      `/api/seller/products/${product.id}/coupons`,
      ownerCookie,
      {
        code: couponCode,
        discountType: "percent",
        discountValue: 20,
        startsAt: currentStart,
        endsAt: currentEnd,
        maxRedemptions: 5,
        isActive: true,
      }
    );

    const expiredCouponCreate = await postJson(
      `/api/seller/products/${product.id}/coupons`,
      ownerCookie,
      {
        code: expiredCouponCode,
        discountType: "fixed",
        discountValue: 2.5,
        startsAt: pastStart,
        endsAt: pastEnd,
        maxRedemptions: 2,
        isActive: true,
      }
    );

    if (
      campaignCreate.status !== 200 ||
      inactiveCampaignCreate.status !== 200 ||
      couponCreate.status !== 200 ||
      expiredCouponCreate.status !== 200
    ) {
      throw new Error("No se pudieron crear las promos QA via API owner.");
    }

    const anonymousResponse = await request(`/seller/products/${product.id}/promotions`);
    recordCase(
      results,
      "anonimo_bloqueado_en_promociones_producto",
      "critical",
      anonymousResponse.status >= 300 &&
        anonymousResponse.status < 400 &&
        (anonymousResponse.headers.get("location") || "").includes("/login"),
      `status=${anonymousResponse.status}, location=${anonymousResponse.headers.get("location")}`,
      "Debe redirigir a /login"
    );

    const workspaceResponse = await request(`/seller/products/${product.id}`, {
      headers: { cookie: ownerCookie },
    });
    const workspaceHtml = await workspaceResponse.text();
    recordCase(
      results,
      "continuidad_workspace_a_promociones",
      "critical",
      workspaceResponse.status === 200 &&
        workspaceHtml.includes(`/seller/products/${product.id}/promotions`),
      `status=${workspaceResponse.status}`,
      "El workspace del producto debe enlazar la capa comercial"
    );

    const ownerResponse = await request(`/seller/products/${product.id}/promotions`, {
      headers: { cookie: ownerCookie },
    });
    const ownerHtml = await ownerResponse.text();
    recordCase(
      results,
      "seller_owner_ve_campanas_y_cupones_de_su_producto",
      "critical",
      ownerResponse.status === 200 &&
        ownerHtml.includes("QA Campaign Vigente") &&
        ownerHtml.includes("QA Campaign Inactiva") &&
        ownerHtml.includes(couponCode) &&
        ownerHtml.includes(expiredCouponCode),
      `status=${ownerResponse.status}`,
      "Debe renderizar promos y cupones del producto"
    );

    recordCase(
      results,
      "seller_owner_ve_estados_vigente_inactiva_y_caducada",
      "high",
      ownerHtml.includes("vigente") &&
        ownerHtml.includes("inactiva") &&
        ownerHtml.includes("caducada"),
      "HTML incluye estados comerciales esperados",
      "La capa comercial debe exponer estado operativo claro"
    );

    recordCase(
      results,
      "seller_owner_ve_senales_de_impacto_comercial",
      "high",
      ownerHtml.includes("Compras 30d") &&
        ownerHtml.includes("Ingresos 30d") &&
        ownerHtml.includes("Campanas") &&
        ownerHtml.includes("Cupones"),
      "HTML incluye metricas basicas recientes",
      "Debe mantener continuidad con la salud comercial del producto"
    );

    recordCase(
      results,
      "seller_owner_tiene_vuelta_al_workspace",
      "high",
      ownerHtml.includes(`/seller/products/${product.id}`),
      "Existe enlace de vuelta al workspace seller",
      "La continuidad comercial no debe aislar el producto"
    );

    const otherSellerResponse = await request(`/seller/products/${product.id}/promotions`, {
      headers: { cookie: otherSellerCookie },
    });
    recordCase(
      results,
      "seller_no_owner_no_ve_promociones_ajenas",
      "critical",
      otherSellerResponse.status >= 300 &&
        otherSellerResponse.status < 400 &&
        (otherSellerResponse.headers.get("location") || "").includes("/seller"),
      `status=${otherSellerResponse.status}, location=${otherSellerResponse.headers.get("location")}`,
      "Debe redirigir fuera del workspace comercial ajeno"
    );

    const otherSellerCampaignAttempt = await postJson(
      `/api/seller/products/${product.id}/campaigns`,
      otherSellerCookie,
      {
        title: "Other seller forbidden campaign",
        campaignType: "flash_deal",
        discountType: "percent",
        discountValue: 10,
        isActive: true,
      }
    );
    recordCase(
      results,
      "seller_no_owner_no_opera_campanas_ajenas",
      "critical",
      otherSellerCampaignAttempt.status === 404,
      `status=${otherSellerCampaignAttempt.status}`,
      "No debe poder crear campanas sobre producto ajeno"
    );

    const buyerResponse = await request(`/seller/products/${product.id}/promotions`, {
      headers: { cookie: buyerCookie },
    });
    recordCase(
      results,
      "buyer_no_ve_workspace_comercial_seller",
      "critical",
      buyerResponse.status >= 300 &&
        buyerResponse.status < 400 &&
        (buyerResponse.headers.get("location") || "").includes("/seller"),
      `status=${buyerResponse.status}, location=${buyerResponse.headers.get("location")}`,
      "El buyer no debe acceder al workspace comercial seller"
    );

    const buyerCouponAttempt = await postJson(
      `/api/seller/products/${product.id}/coupons`,
      buyerCookie,
      {
        code: `BUYER${String(Date.now()).slice(-4)}`,
        discountType: "percent",
        discountValue: 10,
        isActive: true,
      }
    );
    recordCase(
      results,
      "buyer_no_opera_cupones_seller",
      "critical",
      buyerCouponAttempt.status === 403,
      `status=${buyerCouponAttempt.status}`,
      "El buyer no debe crear cupones seller"
    );

    const emptyResponse = await request(`/seller/products/${emptyProduct.id}/promotions`, {
      headers: { cookie: ownerCookie },
    });
    const emptyHtml = await emptyResponse.text();
    recordCase(
      results,
      "workspace_muestra_empty_state_comercial",
      "high",
      emptyResponse.status === 200 &&
        emptyHtml.includes("Aun no hay campanas para este producto.") &&
        emptyHtml.includes("Aun no hay cupones para este producto."),
      `status=${emptyResponse.status}`,
      "Debe existir empty state claro para capa comercial"
    );

    const failed = results.filter((test) => test.status === "FAIL");
    console.log(
      JSON.stringify(
        {
          executedAt: new Date().toISOString(),
          productId: product.id,
          emptyProductId: emptyProduct.id,
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
