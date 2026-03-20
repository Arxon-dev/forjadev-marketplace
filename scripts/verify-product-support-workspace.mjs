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
  throw new Error("Faltan variables de entorno de Supabase para la QA de soporte por producto.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.PRODUCT_SUPPORT_QA_PORT || 3214);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const QA_PASSWORD = "ForjaDevQA!2026";
const OWNER_EMAIL = "qa-release-owner@forjadev.local";
const OTHER_SELLER_EMAIL = "qa-release-other@forjadev.local";
const BUYER_EMAIL = "qa-release-buyer@forjadev.local";

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

  throw new Error("No se pudo iniciar el servidor local para la QA de soporte por producto.");
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

async function setupProduct({ ownerVendorId, buyerUserId, slugPrefix }) {
  const { data: product, error: productError } = await adminSupabase
    .from("products")
    .insert([
      {
        vendor_id: ownerVendorId,
        title: `QA Product Support ${slugPrefix}`,
        slug: `${slugPrefix}-${Date.now()}`,
        short_description: "Producto QA para soporte por producto.",
        description: "Producto QA para validar soporte seller por producto.",
        price_cents: 1900,
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
        changelog: "Release activa QA para soporte.",
        release_status: "active",
        activated_at: new Date().toISOString(),
      },
    ])
    .select("id, version")
    .single();

  if (versionError || !version) {
    throw versionError || new Error("No se pudo crear la version activa QA.");
  }

  const fileName = "qa-support-active.zip";
  const filePath = await uploadStorageZip({
    vendorId: product.vendor_id,
    productId: product.id,
    versionId: version.id,
    fileName,
    contents: Buffer.from("PK-QA-SUPPORT"),
  });

  const { error: fileError } = await adminSupabase.from("product_files").insert([
    {
      product_version_id: version.id,
      storage_path: filePath,
      file_name: fileName,
      file_size_bytes: Buffer.byteLength("PK-QA-SUPPORT"),
    },
  ]);

  if (fileError) {
    throw fileError;
  }

  const { data: order, error: orderError } = await adminSupabase
    .from("orders")
    .insert([
      {
        user_id: buyerUserId,
        total_cents: 1900,
        currency: "EUR",
        status: "completed",
      },
    ])
    .select("id")
    .single();

  if (orderError || !order) {
    throw orderError || new Error("No se pudo crear el pedido QA.");
  }

  const { data: orderItem, error: orderItemError } = await adminSupabase
    .from("order_items")
    .insert([
      {
        order_id: order.id,
        product_id: product.id,
        price_cents: 1900,
      },
    ])
    .select("id")
    .single();

  if (orderItemError || !orderItem) {
    throw orderItemError || new Error("No se pudo crear el order item QA.");
  }

  const { error: licenseError } = await adminSupabase.from("licenses").insert([
    {
      order_item_id: orderItem.id,
      product_id: product.id,
      user_id: buyerUserId,
      license_key: `QA-SUPPORT-${Date.now()}`,
      status: "active",
    },
  ]);

  if (licenseError) {
    throw licenseError;
  }

  return product;
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
      displayName: "QA Release Owner",
      username: "qa_release_owner",
    });
    const otherSellerUser = await ensureUser({
      email: OTHER_SELLER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Release Other Seller",
      username: "qa_release_other",
    });
    const buyerUser = await ensureUser({
      email: BUYER_EMAIL,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Release Buyer",
      username: "qa_release_buyer",
    });

    const ownerVendor = await ensureVendor(
      ownerUser.id,
      "qa-support-owner-store",
      "QA Support Owner Store"
    );
    await ensureVendor(otherSellerUser.id, "qa-support-other-store", "QA Support Other Store");

    const product = await setupProduct({
      ownerVendorId: ownerVendor.id,
      buyerUserId: buyerUser.id,
      slugPrefix: "qa-product-support",
    });
    const emptyProduct = await setupProduct({
      ownerVendorId: ownerVendor.id,
      buyerUserId: buyerUser.id,
      slugPrefix: "qa-product-support-empty",
    });

    const ownerCookie = await login(OWNER_EMAIL, QA_PASSWORD);
    const otherSellerCookie = await login(OTHER_SELLER_EMAIL, QA_PASSWORD);
    const buyerCookie = await login(BUYER_EMAIL, QA_PASSWORD);

    const ticketOne = await postJson("/api/support/tickets", buyerCookie, {
      productId: product.id,
      subject: "QA ticket esperando seller",
      message: "Necesito ayuda con la instalacion QA.",
      priority: "high",
    });

    if (ticketOne.status !== 200 || !ticketOne.payload.ticketId) {
      throw new Error("No se pudo crear el ticket QA principal.");
    }

    const waitingSellerTicketId = ticketOne.payload.ticketId;

    const ticketTwo = await postJson("/api/support/tickets", buyerCookie, {
      productId: product.id,
      subject: "QA ticket esperando buyer",
      message: "Tengo una duda de compatibilidad QA.",
      priority: "normal",
    });

    if (ticketTwo.status !== 200 || !ticketTwo.payload.ticketId) {
      throw new Error("No se pudo crear el ticket QA secundario.");
    }

    const waitingBuyerTicketId = ticketTwo.payload.ticketId;
    await postJson(`/api/support/tickets/${waitingBuyerTicketId}/messages`, ownerCookie, {
      body: "Te comparto la respuesta QA del seller.",
    });

    const ticketThree = await postJson("/api/support/tickets", buyerCookie, {
      productId: product.id,
      subject: "QA ticket cerrado",
      message: "Caso QA para cierre.",
      priority: "normal",
    });

    if (ticketThree.status !== 200 || !ticketThree.payload.ticketId) {
      throw new Error("No se pudo crear el ticket QA cerrado.");
    }

    const closedTicketId = ticketThree.payload.ticketId;
    await postJson(`/api/support/tickets/${closedTicketId}/status`, ownerCookie, {
      status: "closed",
    });

    const anonymousResponse = await request(`/seller/products/${product.id}/support`);
    recordCase(
      results,
      "anonimo_bloqueado_en_soporte_producto",
      "critical",
      anonymousResponse.status >= 300 &&
        anonymousResponse.status < 400 &&
        (anonymousResponse.headers.get("location") || "").includes("/login"),
      `status=${anonymousResponse.status}, location=${anonymousResponse.headers.get("location")}`,
      "Debe redirigir a /login"
    );

    const ownerResponse = await request(`/seller/products/${product.id}/support`, {
      headers: { cookie: ownerCookie },
    });
    const ownerHtml = await ownerResponse.text();
    recordCase(
      results,
      "seller_owner_ve_soporte_de_su_producto",
      "critical",
      ownerResponse.status === 200 &&
        ownerHtml.includes("QA ticket esperando seller") &&
        ownerHtml.includes("QA ticket esperando buyer") &&
        ownerHtml.includes("QA ticket cerrado"),
      `status=${ownerResponse.status}`,
      "Debe renderizar los tickets del producto"
    );

    recordCase(
      results,
      "seller_owner_ve_estado_prioridad_y_ultima_actividad",
      "high",
      ownerHtml.includes("Esperando seller") &&
        ownerHtml.includes("Alta prioridad") &&
        ownerHtml.includes("Ultima actividad:"),
      "HTML incluye estado, prioridad y ultima actividad",
      "La cola debe exponer senales operativas claras"
    );

    recordCase(
      results,
      "seller_owner_tiene_continuidad_workspace_a_ticket",
      "critical",
      ownerHtml.includes(`/support/tickets/${waitingSellerTicketId}?workspaceProductId=${product.id}`),
      "Existe link contextual al ticket desde el soporte del producto",
      "Debe poder abrir el ticket sin perder el contexto del producto"
    );

    const ticketPageResponse = await request(
      `/support/tickets/${waitingSellerTicketId}?workspaceProductId=${product.id}`,
      {
        headers: { cookie: ownerCookie },
      }
    );
    const ticketPageHtml = await ticketPageResponse.text();
    recordCase(
      results,
      "seller_owner_tiene_vuelta_del_ticket_al_soporte_producto",
      "critical",
      ticketPageResponse.status === 200 &&
        ticketPageHtml.includes("Volver al soporte del producto"),
      `status=${ticketPageResponse.status}`,
      "El ticket debe mantener la continuidad de vuelta al soporte del producto"
    );

    const otherSellerResponse = await request(`/seller/products/${product.id}/support`, {
      headers: { cookie: otherSellerCookie },
    });
    recordCase(
      results,
      "seller_no_owner_no_ve_soporte_ajeno",
      "critical",
      otherSellerResponse.status >= 300 &&
        otherSellerResponse.status < 400 &&
        (otherSellerResponse.headers.get("location") || "").includes("/seller"),
      `status=${otherSellerResponse.status}, location=${otherSellerResponse.headers.get("location")}`,
      "Debe redirigir fuera del soporte del producto ajeno"
    );

    const buyerResponse = await request(`/seller/products/${product.id}/support`, {
      headers: { cookie: buyerCookie },
    });
    recordCase(
      results,
      "buyer_no_ve_workspace_de_soporte_seller",
      "critical",
      buyerResponse.status >= 300 &&
        buyerResponse.status < 400 &&
        (buyerResponse.headers.get("location") || "").includes("/seller"),
      `status=${buyerResponse.status}, location=${buyerResponse.headers.get("location")}`,
      "El buyer no debe acceder al soporte seller del producto"
    );

    const emptyResponse = await request(`/seller/products/${emptyProduct.id}/support`, {
      headers: { cookie: ownerCookie },
    });
    const emptyHtml = await emptyResponse.text();
    recordCase(
      results,
      "workspace_muestra_estado_vacio_sin_tickets",
      "high",
      emptyResponse.status === 200 &&
        emptyHtml.includes("Todavia no hay tickets para este producto."),
      `status=${emptyResponse.status}`,
      "Debe existir empty state claro"
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
