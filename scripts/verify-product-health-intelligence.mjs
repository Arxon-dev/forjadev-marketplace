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
  throw new Error("Faltan variables de entorno de Supabase para la QA product health intelligence.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.PRODUCT_HEALTH_INTELLIGENCE_QA_PORT || 3243);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const QA_PASSWORD = "ForjaDevQA!2026";

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
  throw new Error("No se pudo iniciar el servidor local para la QA product health intelligence.");
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
      `No se pudo iniciar el servidor local para la QA product health intelligence. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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

  const { data: vendor, error } = await adminSupabase
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

async function createApprovedProduct({ vendorId, title, slug }) {
  const { data: product, error } = await adminSupabase
    .from("products")
    .insert([
      {
        vendor_id: vendorId,
        title,
        slug,
        short_description: `${title} QA intelligence.`,
        description: `${title} QA intelligence.`,
        price_cents: 2900,
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
        changelog: "Release activa QA health intelligence.",
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
    fileName: `${slug}.zip`,
    contents: Buffer.from("PK-QA-PRODUCT-HEALTH"),
  });

  const { error: fileError } = await adminSupabase.from("product_files").insert([
    {
      product_version_id: version.id,
      storage_path: filePath,
      file_name: `${slug}.zip`,
      file_size_bytes: Buffer.byteLength("PK-QA-PRODUCT-HEALTH"),
    },
  ]);

  if (fileError) {
    throw fileError;
  }

  return product;
}

async function createOrderWithLicense({ buyerUserId, productId }) {
  const { data: order, error: orderError } = await adminSupabase
    .from("orders")
    .insert([
      {
        user_id: buyerUserId,
        status: "completed",
        total_cents: 2900,
      },
    ])
    .select("id")
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
        price_cents: 2900,
      },
    ])
    .select("id")
    .single();

  if (itemError || !orderItem) {
    throw itemError || new Error("No se pudo crear el item de orden QA.");
  }

  const { data: license, error: licenseError } = await adminSupabase
    .from("licenses")
    .insert([
      {
        product_id: productId,
        order_item_id: orderItem.id,
        user_id: buyerUserId,
        license_key: `QA-HEALTH-${Date.now()}`,
        status: "active",
      },
    ])
    .select("id")
    .single();

  if (licenseError || !license) {
    throw licenseError || new Error("No se pudo crear la licencia QA.");
  }

  return { order, license };
}

async function createSupportTicket({ buyerUserId, vendorId, productId }) {
  const { error } = await adminSupabase.from("support_tickets").insert([
    {
      product_id: productId,
      vendor_id: vendorId,
      buyer_user_id: buyerUserId,
      subject: "QA inteligencia operativa del producto",
      status: "waiting_seller",
      priority: "high",
    },
  ]);

  if (error) {
    throw error;
  }
}

async function createDispute({ buyerUserId, orderId, productId, licenseId }) {
  const { error } = await adminSupabase.from("disputes").insert([
    {
      order_id: orderId,
      license_id: licenseId,
      product_id: productId,
      opened_by_user_id: buyerUserId,
      status: "reviewing",
      reason: "QA dispute for product health intelligence.",
    },
  ]);

  if (error) {
    throw error;
  }
}

async function seedAnalytics({ productId, vendorId }) {
  const today = new Date();
  const rows = Array.from({ length: 3 }).map((_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - index);
    return {
      product_id: productId,
      vendor_id: vendorId,
      day: day.toISOString().slice(0, 10),
      view_count: 40,
      click_count: 16,
      add_to_cart_count: 6,
      purchase_count: 2,
      download_count: 2,
      revenue_cents: 5800,
    };
  });

  const { error } = await adminSupabase.from("product_analytics_daily").upsert(rows, {
    onConflict: "product_id,day",
  });

  if (error) {
    throw error;
  }
}

async function seedProductRiskSnapshot({ productId, vendorId }) {
  const { error } = await adminSupabase.from("product_risk_snapshots").upsert(
    [
      {
        product_id: productId,
        vendor_id: vendorId,
        open_risk_event_count: 1,
        high_risk_event_count: 0,
        open_dispute_count: 1,
        license_anomaly_count: 0,
        risk_score: 42,
      },
    ],
    { onConflict: "product_id" }
  );

  if (error) {
    throw error;
  }
}

function getCookieHeaderFromResponse(response) {
  const setCookies = response.headers.getSetCookie?.() || [];
  return setCookies.map((value) => value.split(";")[0]).join("; ");
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
    const seed = Date.now();
    const sellerEmail = `qa-health-seller-${seed}@forjadev.local`;
    const adminEmail = `qa-health-admin-${seed}@forjadev.local`;
    const buyerEmail = `qa-health-buyer-${seed}@forjadev.local`;
    const otherSellerEmail = `qa-health-other-${seed}@forjadev.local`;

    const seller = await ensureUser({
      email: sellerEmail,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Health Seller",
      username: `qa_health_seller_${seed}`,
    });
    const admin = await ensureUser({
      email: adminEmail,
      password: QA_PASSWORD,
      role: "admin",
      displayName: "QA Health Admin",
      username: `qa_health_admin_${seed}`,
    });
    const buyer = await ensureUser({
      email: buyerEmail,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Health Buyer",
      username: `qa_health_buyer_${seed}`,
    });
    await ensureUser({
      email: otherSellerEmail,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Health Other",
      username: `qa_health_other_${seed}`,
    });

    const vendor = await ensureVendor(seller.id, "qa-health-seller", "QA Health Seller Store");
    const product = await createApprovedProduct({
      vendorId: vendor.id,
      title: `QA Product Health ${seed}`,
      slug: `qa-product-health-${seed}`,
    });

    const purchase = await createOrderWithLicense({
      buyerUserId: buyer.id,
      productId: product.id,
    });
    await createSupportTicket({
      buyerUserId: buyer.id,
      vendorId: vendor.id,
      productId: product.id,
    });
    await createDispute({
      buyerUserId: buyer.id,
      orderId: purchase.order.id,
      productId: product.id,
      licenseId: purchase.license.id,
    });
    await seedAnalytics({ productId: product.id, vendorId: vendor.id });
    await seedProductRiskSnapshot({ productId: product.id, vendorId: vendor.id });

    server = await startServer();

    const sellerCookie = await login(sellerEmail, QA_PASSWORD);
    const adminCookie = await login(adminEmail, QA_PASSWORD);

    const sellerResponse = await request(`/seller/products/${product.id}`, {
      headers: { cookie: sellerCookie },
    });
    const sellerHtml = normalizeHtml(await sellerResponse.text());
    recordCase(
      results,
      "seller_workspace_muestra_snapshot_accionable",
      "critical",
      sellerResponse.status === 200 &&
        sellerHtml.includes('data-product-health-panel="seller"') &&
        sellerHtml.includes("Lectura de salud del producto") &&
        sellerHtml.includes("Atencion operativa inmediata") &&
        sellerHtml.includes("Responder 1 ticket(s) que siguen esperando al seller") &&
        sellerHtml.includes("Conversion 30d"),
      `status=${sellerResponse.status}`,
      "El seller debe ver una lectura accionable de salud por producto."
    );

    recordCase(
      results,
      "snapshot_combina_traccion_y_friccion_postsale",
      "critical",
      sellerHtml.includes("Views 30d") &&
        sellerHtml.includes("Compras 30d") &&
        sellerHtml.includes("Tickets abiertos") &&
        sellerHtml.includes("Disputas activas") &&
        sellerHtml.includes("Risk score"),
      "seller_panel_signals",
      "La inteligencia debe unir performance comercial con friccion operativa."
    );

    const adminResponse = await request(`/admin/products/${product.id}`, {
      headers: { cookie: adminCookie },
    });
    const adminHtml = normalizeHtml(await adminResponse.text());
    recordCase(
      results,
      "admin_review_reutiliza_lectura_compartida",
      "critical",
      adminResponse.status === 200 &&
        adminHtml.includes('data-product-health-panel="admin"') &&
        adminHtml.includes("Lectura de salud del producto") &&
        adminHtml.includes("Atencion operativa inmediata") &&
        adminHtml.includes("Responder 1 ticket(s) que siguen esperando al seller"),
      `status=${adminResponse.status}`,
      "Admin debe reutilizar la misma lectura accionable sin otro dashboard."
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      throw new Error(
        `QA product health intelligence con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
      );
    }

    console.log(JSON.stringify({ results }, null, 2));
  } finally {
    if (server) {
      server.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
