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

function normalizeHtml(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();
}

const projectRoot = process.cwd();
loadEnvFile(resolve(projectRoot, ".env.local"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan variables de entorno de Supabase para la QA seller post-sale visibility.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.SELLER_POSTSALE_VISIBILITY_QA_PORT || 3223);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const QA_PASSWORD = "ForjaDevQA!2026";
const OWNER_EMAIL = "qa-postsale-owner@forjadev.local";
const OTHER_SELLER_EMAIL = "qa-postsale-other@forjadev.local";
const BUYER_EMAIL = "qa-postsale-buyer@forjadev.local";

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

async function waitForServer(timeoutMs = 60000) {
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

  throw new Error("No se pudo iniciar el servidor local para la QA seller post-sale visibility.");
}

async function startServer() {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, ["qa-release-server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForServer();
  } catch {
    child.kill("SIGTERM");
    throw new Error(
      `No se pudo iniciar el servidor local para la QA seller post-sale visibility. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
    );
  }

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

async function createApprovedProduct({ ownerVendorId, titlePrefix, slugPrefix, shortDescription }) {
  const seed = Date.now();
  const { data: product, error: productError } = await adminSupabase
    .from("products")
    .insert([
      {
        vendor_id: ownerVendorId,
        title: `${titlePrefix} ${seed}`,
        slug: `${slugPrefix}-${seed}`,
        short_description: shortDescription,
        description: shortDescription,
        price_cents: 2400,
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
        changelog: "Release activa QA postsale.",
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
    fileName: "qa-postsale.zip",
    contents: Buffer.from("PK-QA-POSTSALE"),
  });

  const { error: fileError } = await adminSupabase.from("product_files").insert([
    {
      product_version_id: version.id,
      storage_path: filePath,
      file_name: "qa-postsale.zip",
      file_size_bytes: Buffer.byteLength("PK-QA-POSTSALE"),
    },
  ]);

  if (fileError) {
    throw fileError;
  }

  return product;
}

async function createOrderWithLicense({ buyerUserId, productId, refunded = false }) {
  const { data: order, error: orderError } = await adminSupabase
    .from("orders")
    .insert([
      {
        user_id: buyerUserId,
        total_cents: 2400,
        currency: "EUR",
        status: refunded ? "refunded" : "completed",
      },
    ])
    .select("id, created_at")
    .single();

  if (orderError || !order) {
    throw orderError || new Error("No se pudo crear la orden QA.");
  }

  const { data: orderItem, error: orderItemError } = await adminSupabase
    .from("order_items")
    .insert([
      {
        order_id: order.id,
        product_id: productId,
        price_cents: 2400,
      },
    ])
    .select("id")
    .single();

  if (orderItemError || !orderItem) {
    throw orderItemError || new Error("No se pudo crear el order item QA.");
  }

  const { data: license, error: licenseError } = await adminSupabase
    .from("licenses")
    .insert([
      {
        order_item_id: orderItem.id,
        product_id: productId,
        user_id: buyerUserId,
        license_key: `QA-POSTSALE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: refunded ? "revoked" : "active",
        last_validated_at: refunded ? new Date().toISOString() : null,
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

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const owner = await ensureUser({
    email: OWNER_EMAIL,
    password: QA_PASSWORD,
    role: "seller",
    displayName: "QA PostSale Owner",
    username: `qa-postsale-owner-${Date.now()}`,
  });
  const otherSeller = await ensureUser({
    email: OTHER_SELLER_EMAIL,
    password: QA_PASSWORD,
    role: "seller",
    displayName: "QA PostSale Other",
    username: `qa-postsale-other-${Date.now()}`,
  });
  const buyer = await ensureUser({
    email: BUYER_EMAIL,
    password: QA_PASSWORD,
    role: "buyer",
    displayName: "QA PostSale Buyer",
    username: `qa-postsale-buyer-${Date.now()}`,
  });

  const ownerVendor = await ensureVendor(owner.id, "qa-postsale-owner", "QA PostSale Owner Store");
  await ensureVendor(otherSeller.id, "qa-postsale-other", "QA PostSale Other Store");

  const noisyProduct = await createApprovedProduct({
    ownerVendorId: ownerVendor.id,
    titlePrefix: "QA PostSale Signal Product",
    slugPrefix: "qa-postsale-signal-product",
    shortDescription: "Producto QA con senales postventa.",
  });
  const stableProduct = await createApprovedProduct({
    ownerVendorId: ownerVendor.id,
    titlePrefix: "QA PostSale Stable Product",
    slugPrefix: "qa-postsale-stable-product",
    shortDescription: "Producto QA estable sin incidencias postventa.",
  });

  const refundedPurchase = await createOrderWithLicense({
    buyerUserId: buyer.id,
    productId: noisyProduct.id,
    refunded: true,
  });
  const disputedPurchase = await createOrderWithLicense({
    buyerUserId: buyer.id,
    productId: noisyProduct.id,
    refunded: false,
  });

  const { data: supportTicket, error: supportTicketError } = await adminSupabase
    .from("support_tickets")
    .insert([
      {
        product_id: noisyProduct.id,
        vendor_id: ownerVendor.id,
        buyer_user_id: buyer.id,
        subject: "El archivo descargado no coincide con la promesa del producto",
        status: "waiting_seller",
        priority: "high",
      },
    ])
    .select("id")
    .single();

  if (supportTicketError || !supportTicket) {
    throw supportTicketError || new Error("No se pudo crear el ticket QA.");
  }

  const { data: dispute, error: disputeError } = await adminSupabase
    .from("disputes")
    .insert([
      {
        order_id: disputedPurchase.order.id,
        license_id: disputedPurchase.license.id,
        product_id: noisyProduct.id,
        opened_by_user_id: buyer.id,
        status: "reviewing",
        reason: "Necesito una revision administrativa por discrepancia postventa.",
      },
    ])
    .select("id")
    .single();

  if (disputeError || !dispute) {
    throw disputeError || new Error("No se pudo crear la disputa QA.");
  }

  const { error: riskEventError } = await adminSupabase.from("risk_events").insert([
    {
      entity_type: "dispute",
      entity_id: dispute.id,
      vendor_id: ownerVendor.id,
      user_id: buyer.id,
      severity: "medium",
      code: "post_sale_guardrail_triggered",
      title: "Refund emitido con senales postventa relevantes",
      details: "QA signal",
      status: "open",
    },
  ]);

  if (riskEventError) {
    throw riskEventError;
  }

  const server = await startServer();

  try {
    const ownerCookie = await login(OWNER_EMAIL, QA_PASSWORD);
    const otherSellerCookie = await login(OTHER_SELLER_EMAIL, QA_PASSWORD);

    const workspaceResponse = await request(`/seller/products/${noisyProduct.id}`, {
      headers: { cookie: ownerCookie },
    });
    expect(workspaceResponse.status === 200, `El owner seller no pudo abrir el workspace (${workspaceResponse.status}).`);

    const workspaceHtml = normalizeHtml(await workspaceResponse.text());
    expect(
      workspaceHtml.includes("Salud postventa del producto"),
      "El workspace seller no muestra el panel de salud postventa."
    );
    expect(
      workspaceHtml.includes("Lectura postventa actual: 1 ticket(s) esperando seller | 1 disputa(s) activa(s) | 1 refund(s) emitido(s) | 1 licencia(s) revocada(s) | 1 senal(es) de riesgo abierta(s)."),
      "El workspace seller no refleja el resumen compacto esperado."
    );
    expect(
      workspaceHtml.includes("Responder 1 ticket(s) que estan esperando al seller."),
      "El workspace seller no muestra la siguiente accion esperada."
    );

    const supportResponse = await request(`/seller/products/${noisyProduct.id}/support`, {
      headers: { cookie: ownerCookie },
    });
    expect(supportResponse.status === 200, `El owner seller no pudo abrir soporte por producto (${supportResponse.status}).`);

    const supportHtml = normalizeHtml(await supportResponse.text());
    expect(
      supportHtml.includes("Salud postventa del producto"),
      "La ruta de soporte del producto no reutiliza el panel postventa."
    );
    expect(
      supportHtml.includes("Abrir soporte"),
      "La continuidad operativa del panel no se renderizo en soporte."
    );

    const stableResponse = await request(`/seller/products/${stableProduct.id}`, {
      headers: { cookie: ownerCookie },
    });
    expect(stableResponse.status === 200, `El owner seller no pudo abrir el producto estable (${stableResponse.status}).`);

    const stableHtml = normalizeHtml(await stableResponse.text());
    expect(
      stableHtml.includes("Sin incidentes postventa relevantes registrados para este producto."),
      "El producto estable no muestra el empty state esperado."
    );
    expect(
      stableHtml.includes("No hay incidentes postventa recientes para este producto."),
      "El producto estable no muestra el estado vacio de eventos."
    );

    const otherSellerResponse = await request(`/seller/products/${noisyProduct.id}`, {
      headers: { cookie: otherSellerCookie },
    });
    expect(
      otherSellerResponse.status === 307 && otherSellerResponse.headers.get("location") === "/seller",
      `El seller no owner no fue bloqueado correctamente (${otherSellerResponse.status} -> ${otherSellerResponse.headers.get("location")}).`
    );

    console.log("PASS seller post-sale visibility");
    console.log(`- workspace seller owner con senales postventa: PASS (${noisyProduct.id})`);
    console.log(`- continuidad workspace -> soporte del producto: PASS (${supportTicket.id})`);
    console.log(`- producto estable con empty state claro: PASS (${stableProduct.id})`);
    console.log(`- seller no owner bloqueado: PASS (${otherSeller.id})`);
    console.log(`- signals seeded: dispute=${dispute.id} refundedOrder=${refundedPurchase.order.id} revokedLicense=${refundedPurchase.license.id}`);
  } finally {
    server.kill("SIGTERM");
  }
}

await main();
