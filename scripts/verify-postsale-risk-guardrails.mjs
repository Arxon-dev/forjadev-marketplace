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
  throw new Error("Faltan variables de entorno de Supabase para la QA post-sale guardrails.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.POSTSALE_GUARDRAILS_QA_PORT || 3222);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const QA_PASSWORD = "ForjaDevQA!2026";
const BUYER_EMAIL = "qa-guardrails-buyer@forjadev.local";
const SELLER_EMAIL = "qa-guardrails-seller@forjadev.local";
const ADMIN_EMAIL = "qa-guardrails-admin@forjadev.local";

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
  throw new Error("No se pudo iniciar el servidor local para la QA post-sale guardrails.");
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
      `No se pudo iniciar el servidor local para la QA post-sale guardrails. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA Guardrails Seller",
        slug: `qa-guardrails-${Date.now()}`,
        bio: "QA guardrails store",
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

async function createApprovedProduct(vendorId) {
  const seed = Date.now();
  const { data: product, error } = await adminSupabase
    .from("products")
    .insert([
      {
        vendor_id: vendorId,
        title: `QA Guardrail Product ${seed}`,
        slug: `qa-guardrail-product-${seed}`,
        short_description: "Producto QA guardrails.",
        description: "Producto QA guardrails.",
        price_cents: 3500,
        is_free: false,
        moderation_status: "approved",
        refund_policy: "Refund solo tras revision y con contexto suficiente de soporte/disputa.",
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
        changelog: "Release activa QA guardrails.",
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
    fileName: "qa-guardrails.zip",
    contents: Buffer.from("PK-QA-GUARDRAILS"),
  });

  const { error: fileError } = await adminSupabase.from("product_files").insert([
    {
      product_version_id: version.id,
      storage_path: filePath,
      file_name: "qa-guardrails.zip",
      file_size_bytes: Buffer.byteLength("PK-QA-GUARDRAILS"),
    },
  ]);

  if (fileError) {
    throw fileError;
  }

  return product;
}

async function createOrder({ buyerUserId, productId, status = "completed" }) {
  const { data: order, error: orderError } = await adminSupabase
    .from("orders")
    .insert([
      {
        user_id: buyerUserId,
        status,
        total_cents: 3500,
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
        price_cents: 3500,
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
        license_key: `QA-GRD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: status === "refunded" ? "revoked" : "active",
      },
    ])
    .select("id")
    .single();

  if (licenseError || !license) {
    throw licenseError || new Error("No se pudo crear la licencia QA.");
  }

  if (status === "refunded") {
    await adminSupabase
      .from("licenses")
      .update({
        status: "revoked",
        last_validated_at: new Date().toISOString(),
      })
      .eq("id", license.id);
  }

  return { order, orderItem, license };
}

async function createTicket({ buyerUserId, vendorId, productId }) {
  const { data: ticket, error: ticketError } = await adminSupabase
    .from("support_tickets")
    .insert([
      {
        product_id: productId,
        vendor_id: vendorId,
        buyer_user_id: buyerUserId,
        subject: "QA Post-sale guardrail issue",
        status: "waiting_seller",
        priority: "high",
        last_message_at: new Date().toISOString(),
      },
    ])
    .select("id")
    .single();

  if (ticketError || !ticket) {
    throw ticketError || new Error("No se pudo crear el ticket QA.");
  }

  await adminSupabase.from("support_messages").insert([
    {
      ticket_id: ticket.id,
      sender_user_id: buyerUserId,
      body: "QA ticket para validar guardrails postventa.",
    },
  ]);

  return ticket;
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
      displayName: "QA Guardrails Buyer",
      username: "qa_guardrails_buyer",
    });
    const sellerUser = await ensureUser({
      email: SELLER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Guardrails Seller",
      username: "qa_guardrails_seller",
    });
    await ensureUser({
      email: ADMIN_EMAIL,
      password: QA_PASSWORD,
      role: "admin",
      displayName: "QA Guardrails Admin",
      username: "qa_guardrails_admin",
    });

    const vendor = await ensureVendor(sellerUser.id);
    const product = await createApprovedProduct(vendor.id);
    await createOrder({
      buyerUserId: buyerUser.id,
      productId: product.id,
      status: "refunded",
    });
    await createOrder({
      buyerUserId: buyerUser.id,
      productId: product.id,
      status: "refunded",
    });
    const purchase = await createOrder({
      buyerUserId: buyerUser.id,
      productId: product.id,
      status: "completed",
    });
    const ticket = await createTicket({
      buyerUserId: buyerUser.id,
      vendorId: vendor.id,
      productId: product.id,
    });

    await adminSupabase.from("license_anomalies").insert([
      {
        license_id: purchase.license.id,
        product_id: product.id,
        user_id: buyerUser.id,
        anomaly_code: "repeat_refund_pattern",
        severity: "medium",
        details: "QA anomaly to validate post-sale guardrails.",
      },
    ]);

    const buyerCookie = await login(BUYER_EMAIL, QA_PASSWORD);
    const adminCookie = await login(ADMIN_EMAIL, QA_PASSWORD);

    const createDisputeResponse = await request("/api/disputes", {
      method: "POST",
      headers: {
        cookie: buyerCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: purchase.order.id,
        productId: product.id,
        licenseId: purchase.license.id,
        reason: "QA disputa para validar trust safeguards postventa.",
      }),
    });
    const createDisputePayload = await createDisputeResponse.json().catch(() => ({}));
    if (!createDisputeResponse.ok || !createDisputePayload.disputeId) {
      throw new Error(
        `No se pudo crear la disputa QA: status=${createDisputeResponse.status} message=${createDisputePayload.message}`
      );
    }
    const disputeId = createDisputePayload.disputeId;

    const adminDetailResponse = await request(`/admin/disputes/${disputeId}`, {
      headers: { cookie: adminCookie },
    });
    const adminDetailHtml = normalizeHtml(await adminDetailResponse.text());
    recordCase(
      results,
      "admin_ve_guardrails_postventa_en_el_caso",
      "critical",
      adminDetailResponse.status === 200 &&
        adminDetailHtml.includes("Guardrails postventa") &&
        adminDetailHtml.includes("Refunds previos") &&
        adminDetailHtml.includes("Licencias revocadas") &&
        adminDetailHtml.includes("Eventos/anomalias"),
      `status=${adminDetailResponse.status}`,
      "Admin debe ver senales y guardrails visibles antes de resolver"
    );

    const refundWhileOpenResponse = await request(`/api/admin/disputes/${disputeId}/refund`, {
      method: "POST",
      headers: {
        cookie: adminCookie,
        "Content-Type": "application/json",
      },
    });
    const refundWhileOpenPayload = await refundWhileOpenResponse.json().catch(() => ({}));
    recordCase(
      results,
      "admin_no_puede_refund_sin_reviewing",
      "critical",
      refundWhileOpenResponse.status === 409 &&
        String(refundWhileOpenPayload.message || "").includes("revision"),
      `status=${refundWhileOpenResponse.status}, message=${refundWhileOpenPayload.message}`,
      "El refund debe exigir al menos fase reviewing"
    );

    await request(`/api/admin/disputes/${disputeId}/status`, {
      method: "POST",
      headers: {
        cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "reviewing" }),
    });

    const refundResponse = await request(`/api/admin/disputes/${disputeId}/refund`, {
      method: "POST",
      headers: {
        cookie: adminCookie,
        "Content-Type": "application/json",
      },
    });
    const refundPayload = await refundResponse.json().catch(() => ({}));
    recordCase(
      results,
      "admin_puede_refund_con_guardrails_y_revision",
      "critical",
      refundResponse.status === 200 &&
        refundPayload.message === "Reembolso emitido y disputa cerrada correctamente",
      `status=${refundResponse.status}, message=${refundPayload.message}`,
      "Admin debe poder reembolsar una vez revisado el caso"
    );

    const { data: triggeredRiskEvent } = await adminSupabase
      .from("risk_events")
      .select("code, status, details")
      .eq("entity_type", "dispute")
      .eq("entity_id", disputeId)
      .eq("code", "post_sale_guardrail_triggered")
      .order("created_at", { ascending: false })
      .maybeSingle();

    recordCase(
      results,
      "refund_con_senales_genera_evento_de_riesgo",
      "critical",
      triggeredRiskEvent?.code === "post_sale_guardrail_triggered" &&
        triggeredRiskEvent?.status === "open" &&
        String(triggeredRiskEvent?.details || "").includes("Historial repetido de reembolsos"),
      `riskEvent=${triggeredRiskEvent ? triggeredRiskEvent.code : "missing"}, status=${triggeredRiskEvent?.status || "missing"}`,
      "Las senales postventa deben reflejarse como evento accionable"
    );

    const riskPageResponse = await request("/admin/risk", {
      headers: { cookie: adminCookie },
    });
    const riskPageHtml = normalizeHtml(await riskPageResponse.text());
    recordCase(
      results,
      "backoffice_refleja_evento_postventa_en_risk",
      "high",
      riskPageResponse.status === 200 &&
        riskPageHtml.includes("Refund emitido con senales postventa relevantes"),
      `status=${riskPageResponse.status}`,
      "Risk debe reflejar el evento guardrail sin abrir tooling nuevo"
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
  process.exitCode = 1;
});
