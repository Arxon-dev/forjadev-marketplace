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
  throw new Error("Faltan variables de entorno de Supabase para la QA admin risk tooling.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.ADMIN_RISK_DISPUTE_TOOLING_QA_PORT || 3227);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const QA_PASSWORD = "ForjaDevQA!2026";
const ADMIN_EMAIL = "qa-admin-risk-tooling@forjadev.local";
const SELLER_EMAIL = "qa-admin-risk-seller@forjadev.local";
const HIGH_BUYER_EMAIL = "qa-admin-risk-high@forjadev.local";
const LOW_BUYER_EMAIL = "qa-admin-risk-low@forjadev.local";

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
  throw new Error("No se pudo iniciar el servidor local para la QA admin risk tooling.");
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
      `No se pudo iniciar el servidor local para la QA admin risk tooling. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA Admin Risk Seller",
        slug: `qa-admin-risk-${Date.now()}`,
        bio: "QA seller for admin risk tooling.",
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

async function createApprovedProduct(vendorId, title, slug) {
  const { data: product, error } = await adminSupabase
    .from("products")
    .insert([
      {
        vendor_id: vendorId,
        title,
        slug,
        short_description: `${title} QA admin risk.`,
        description: `${title} QA admin risk.`,
        price_cents: 3400,
        is_free: false,
        moderation_status: "approved",
        refund_policy: "El caso se revisa segun soporte, disputa y contexto de acceso.",
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
        changelog: `Release activa ${title}.`,
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
    contents: Buffer.from("PK-QA-ADMIN-RISK"),
  });

  const { error: fileError } = await adminSupabase.from("product_files").insert([
    {
      product_version_id: version.id,
      storage_path: filePath,
      file_name: `${slug}.zip`,
      file_size_bytes: Buffer.byteLength("PK-QA-ADMIN-RISK"),
    },
  ]);

  if (fileError) {
    throw fileError;
  }

  return product;
}

async function createOrderWithLicense({ buyerUserId, productId, totalCents = 3400 }) {
  const { data: order, error: orderError } = await adminSupabase
    .from("orders")
    .insert([
      {
        user_id: buyerUserId,
        status: "completed",
        total_cents: totalCents,
      },
    ])
    .select("id, status, created_at")
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
        license_key: `QA-ADMIN-RISK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: "active",
      },
    ])
    .select("id, status")
    .single();

  if (licenseError || !license) {
    throw licenseError || new Error("No se pudo crear la licencia QA.");
  }

  return { order, orderItem, license };
}

async function createSupportTicket({ buyerUserId, vendorId, productId, subject, status }) {
  const timestamp = new Date().toISOString();
  const { data: ticket, error: ticketError } = await adminSupabase
    .from("support_tickets")
    .insert([
      {
        product_id: productId,
        vendor_id: vendorId,
        buyer_user_id: buyerUserId,
        subject,
        status,
        priority: "high",
        last_message_at: timestamp,
      },
    ])
    .select("id, status")
    .single();

  if (ticketError || !ticket) {
    throw ticketError || new Error("No se pudo crear el ticket QA.");
  }

  const { error: messageError } = await adminSupabase.from("support_messages").insert([
    {
      ticket_id: ticket.id,
      sender_user_id: buyerUserId,
      body: "QA support message for admin triage.",
    },
  ]);

  if (messageError) {
    throw messageError;
  }

  return ticket;
}

async function createDispute({ buyerUserId, orderId, productId, licenseId, status, reason, updatedAt = null }) {
  const payload = {
    order_id: orderId,
    product_id: productId,
    license_id: licenseId,
    opened_by_user_id: buyerUserId,
    status,
    reason,
  };
  const { data: dispute, error } = await adminSupabase
    .from("disputes")
    .insert([payload])
    .select("id, status, updated_at")
    .single();

  if (error || !dispute) {
    throw error || new Error("No se pudo crear la disputa QA.");
  }

  if (updatedAt) {
    const { data: updatedDispute, error: updateError } = await adminSupabase
      .from("disputes")
      .update({ updated_at: updatedAt })
      .eq("id", dispute.id)
      .select("id, status, updated_at")
      .single();

    if (updateError || !updatedDispute) {
      throw updateError || new Error("No se pudo ajustar updated_at de la disputa QA.");
    }

    return updatedDispute;
  }

  return dispute;
}

async function createRiskEvent({ disputeId, buyerUserId }) {
  const { error } = await adminSupabase.from("risk_events").insert([
    {
      entity_type: "dispute",
      entity_id: disputeId,
      user_id: buyerUserId,
      severity: "high",
      code: "qa_high_signal",
      title: "QA post-sale signal",
      details: "QA risk event to verify admin dispute triage.",
      status: "open",
    },
  ]);

  if (error) {
    throw error;
  }
}

async function createLicenseAnomaly({ buyerUserId, productId, licenseId }) {
  const { error } = await adminSupabase.from("license_anomalies").insert([
    {
      user_id: buyerUserId,
      product_id: productId,
      license_id: licenseId,
      anomaly_code: "qa_post_sale_anomaly",
      severity: "high",
      details: "QA anomaly to verify admin dispute triage.",
    },
  ]);

  if (error) {
    throw error;
  }
}

async function markPurchaseRefunded({ orderId, licenseId }) {
  const now = new Date().toISOString();
  const { error: orderError } = await adminSupabase
    .from("orders")
    .update({ status: "refunded" })
    .eq("id", orderId);
  if (orderError) throw orderError;

  const { error: licenseError } = await adminSupabase
    .from("licenses")
    .update({ status: "revoked", last_validated_at: now })
    .eq("id", licenseId);
  if (licenseError) throw licenseError;
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

    const adminUser = await ensureUser({
      email: ADMIN_EMAIL,
      password: QA_PASSWORD,
      role: "admin",
      displayName: "QA Admin Risk",
      username: "qa_admin_risk",
    });
    const sellerUser = await ensureUser({
      email: SELLER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Admin Risk Seller",
      username: "qa_admin_risk_seller",
    });
    const highBuyer = await ensureUser({
      email: HIGH_BUYER_EMAIL,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA High Risk Buyer",
      username: "qa_high_risk_buyer",
    });
    const lowBuyer = await ensureUser({
      email: LOW_BUYER_EMAIL,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Low Risk Buyer",
      username: "qa_low_risk_buyer",
    });

    const vendor = await ensureVendor(sellerUser.id);
    const seed = Date.now();
    const highProduct = await createApprovedProduct(
      vendor.id,
      `QA Admin High ${seed}`,
      `qa-admin-high-${seed}`
    );
    const lowProduct = await createApprovedProduct(
      vendor.id,
      `QA Admin Low ${seed}`,
      `qa-admin-low-${seed}`
    );

    const highPurchase = await createOrderWithLicense({
      buyerUserId: highBuyer.id,
      productId: highProduct.id,
    });
    await createSupportTicket({
      buyerUserId: highBuyer.id,
      vendorId: vendor.id,
      productId: highProduct.id,
      subject: "QA high risk dispute case",
      status: "waiting_seller",
    });
    const highDispute = await createDispute({
      buyerUserId: highBuyer.id,
      orderId: highPurchase.order.id,
      productId: highProduct.id,
      licenseId: highPurchase.license.id,
      status: "reviewing",
      reason: "QA high priority dispute for triage ordering.",
      updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    });
    await createRiskEvent({ disputeId: highDispute.id, buyerUserId: highBuyer.id });
    await createLicenseAnomaly({
      buyerUserId: highBuyer.id,
      productId: highProduct.id,
      licenseId: highPurchase.license.id,
    });

    const priorRefundA = await createOrderWithLicense({
      buyerUserId: highBuyer.id,
      productId: highProduct.id,
    });
    const priorRefundB = await createOrderWithLicense({
      buyerUserId: highBuyer.id,
      productId: highProduct.id,
    });
    await markPurchaseRefunded({ orderId: priorRefundA.order.id, licenseId: priorRefundA.license.id });
    await markPurchaseRefunded({ orderId: priorRefundB.order.id, licenseId: priorRefundB.license.id });

    const lowPurchase = await createOrderWithLicense({
      buyerUserId: lowBuyer.id,
      productId: lowProduct.id,
    });
    await createSupportTicket({
      buyerUserId: lowBuyer.id,
      vendorId: vendor.id,
      productId: lowProduct.id,
      subject: "QA low risk dispute case",
      status: "waiting_buyer",
    });
    const lowDispute = await createDispute({
      buyerUserId: lowBuyer.id,
      orderId: lowPurchase.order.id,
      productId: lowProduct.id,
      licenseId: lowPurchase.license.id,
      status: "open",
      reason: "QA lower priority dispute for triage ordering.",
    });

    const adminCookies = await login(ADMIN_EMAIL, QA_PASSWORD);

    const riskResponse = await request("/admin/risk", {
      headers: { cookie: adminCookies },
    });
    const riskHtml = normalizeHtml(await riskResponse.text());
    const highIndex = riskHtml.indexOf(highProduct.title);
    const lowIndex = riskHtml.indexOf(lowProduct.title);
    recordCase(
      results,
      "admin_risk_muestra_cola_de_triage",
      "critical",
      riskResponse.status === 200 &&
        riskHtml.includes("Triage operativo de disputas") &&
        riskHtml.includes('data-admin-triage-level="high"') &&
        riskHtml.includes('data-admin-triage-level="low"'),
      `status=${riskResponse.status}`,
      "Risk debe mostrar una cola de triage operativa con prioridad visible"
    );
    recordCase(
      results,
      "caso_mas_riesgoso_se_prioriza_antes",
      "critical",
      highIndex !== -1 && lowIndex !== -1 && highIndex < lowIndex,
      `highIndex=${highIndex}, lowIndex=${lowIndex}`,
      "El caso con mayor riesgo y mejor contexto de decision debe aparecer antes"
    );

    const adminDisputeResponse = await request(`/admin/disputes/${highDispute.id}`, {
      headers: { cookie: adminCookies },
    });
    const adminDisputeHtml = normalizeHtml(await adminDisputeResponse.text());
    recordCase(
      results,
      "detalle_admin_hereda_prioridad_y_motivo",
      "critical",
      adminDisputeResponse.status === 200 &&
        adminDisputeHtml.includes("Prioridad alta") &&
        adminDisputeHtml.includes("Motivo de priorizacion"),
      `status=${adminDisputeResponse.status}`,
      "El detalle del caso debe conservar la lectura de prioridad y su motivo"
    );

    recordCase(
      results,
      "triage_sigue_mostrando_siguiente_accion_clara",
      "high",
      riskHtml.includes("Siguiente accion:") && adminDisputeHtml.includes("Siguiente accion:"),
      "queueAndDetailContainNextAction=true",
      "Triage y detalle deben mantener accion administrativa clara"
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      throw new Error(
        `QA admin risk dispute tooling con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
