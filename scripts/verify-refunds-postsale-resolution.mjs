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
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan variables de entorno de Supabase para la QA refunds post-sale.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.REFUNDS_POSTSALE_QA_PORT || 3221);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const QA_PASSWORD = "ForjaDevQA!2026";
const BUYER_EMAIL = "qa-refunds-buyer@forjadev.local";
const OTHER_BUYER_EMAIL = "qa-refunds-other@forjadev.local";
const SELLER_EMAIL = "qa-refunds-seller@forjadev.local";
const ADMIN_EMAIL = "qa-refunds-admin@forjadev.local";

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
  throw new Error("No se pudo iniciar el servidor local para la QA refunds post-sale.");
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
      `No se pudo iniciar el servidor local para la QA refunds post-sale. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA Refunds Seller",
        slug: `qa-refunds-${Date.now()}`,
        bio: "QA refunds store",
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
        title: `QA Refund Product ${seed}`,
        slug: `qa-refund-product-${seed}`,
        short_description: "Producto QA refunds post-sale.",
        description: "Producto QA refunds post-sale.",
        price_cents: 2900,
        is_free: false,
        moderation_status: "approved",
        refund_policy: "Reembolso solo si soporte no ofrece una solucion razonable y el producto incumple lo prometido.",
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
        changelog: "Release activa QA refunds post-sale.",
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
    fileName: "qa-refunds.zip",
    contents: Buffer.from("PK-QA-REFUNDS"),
  });

  const { error: fileError } = await adminSupabase.from("product_files").insert([
    {
      product_version_id: version.id,
      storage_path: filePath,
      file_name: "qa-refunds.zip",
      file_size_bytes: Buffer.byteLength("PK-QA-REFUNDS"),
    },
  ]);

  if (fileError) {
    throw fileError;
  }

  return product;
}

async function createCompletedOrder({ buyerUserId, productId }) {
  const { data: order, error: orderError } = await adminSupabase
    .from("orders")
    .insert([
      {
        user_id: buyerUserId,
        status: "completed",
        total_cents: 2900,
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
        price_cents: 2900,
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
        license_key: `QA-RFD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: "active",
      },
    ])
    .select("id")
    .single();

  if (licenseError || !license) {
    throw licenseError || new Error("No se pudo crear la licencia QA.");
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
        subject: "QA Refund issue",
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

  const { error: messageError } = await adminSupabase.from("support_messages").insert([
    {
      ticket_id: ticket.id,
      sender_user_id: buyerUserId,
      body: "QA ticket para revisar criterio postventa y posible reembolso.",
    },
  ]);

  if (messageError) {
    throw messageError;
  }

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
      displayName: "QA Refunds Buyer",
      username: "qa_refunds_buyer",
    });
    await ensureUser({
      email: OTHER_BUYER_EMAIL,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Refunds Other",
      username: "qa_refunds_other",
    });
    const sellerUser = await ensureUser({
      email: SELLER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Refunds Seller",
      username: "qa_refunds_seller",
    });
    await ensureUser({
      email: ADMIN_EMAIL,
      password: QA_PASSWORD,
      role: "admin",
      displayName: "QA Refunds Admin",
      username: "qa_refunds_admin",
    });

    const vendor = await ensureVendor(sellerUser.id);
    const product = await createApprovedProduct(vendor.id);
    const purchase = await createCompletedOrder({
      buyerUserId: buyerUser.id,
      productId: product.id,
    });
    const ticket = await createTicket({
      buyerUserId: buyerUser.id,
      vendorId: vendor.id,
      productId: product.id,
    });

    const buyerCookie = await login(BUYER_EMAIL, QA_PASSWORD);
    const adminCookie = await login(ADMIN_EMAIL, QA_PASSWORD);

    const buyerOrdersResponse = await request(`/orders?highlightOrder=${purchase.order.id}`, {
      headers: { cookie: buyerCookie },
    });
    const buyerOrdersHtml = normalizeHtml(await buyerOrdersResponse.text());
    recordCase(
      results,
      "buyer_ve_refund_posture_en_orders",
      "critical",
      buyerOrdersResponse.status === 200 &&
        buyerOrdersHtml.includes("Resolucion postventa") &&
        buyerOrdersHtml.includes("Primero pasa por soporte") &&
        buyerOrdersHtml.includes("/policies/reembolsos-y-reclamaciones"),
      `status=${buyerOrdersResponse.status}`,
      "Orders debe mostrar criterio operativo de reembolso"
    );

    const buyerSupportDetailResponse = await request(`/support/tickets/${ticket.id}`, {
      headers: { cookie: buyerCookie },
    });
    const buyerSupportDetailHtml = normalizeHtml(await buyerSupportDetailResponse.text());
    recordCase(
      results,
      "buyer_ve_resultado_postventa_en_ticket",
      "critical",
      buyerSupportDetailResponse.status === 200 &&
        buyerSupportDetailHtml.includes("Resultado postventa") &&
        buyerSupportDetailHtml.includes("Primero pasa por soporte") &&
        buyerSupportDetailHtml.includes("/policies/reembolsos-y-reclamaciones"),
      `status=${buyerSupportDetailResponse.status}`,
      "El ticket buyer debe mostrar criterio y siguiente accion"
    );

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
        reason: "QA disputa para validar refund operativo.",
      }),
    });
    const createDisputePayload = await createDisputeResponse.json().catch(() => ({}));
    if (!createDisputeResponse.ok || !createDisputePayload.disputeId) {
      throw new Error(
        `No se pudo crear la disputa QA de refunds: status=${createDisputeResponse.status} message=${createDisputePayload.message}`
      );
    }
    const disputeId = createDisputePayload.disputeId;

    const reviewingResponse = await request(`/api/admin/disputes/${disputeId}/status`, {
      method: "POST",
      headers: {
        cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "reviewing" }),
    });
    const reviewingPayload = await reviewingResponse.json().catch(() => ({}));
    recordCase(
      results,
      "admin_puede_tomar_revision_antes_del_refund",
      "critical",
      reviewingResponse.status === 200 &&
        reviewingPayload.message === "Disputa actualizada correctamente",
      `status=${reviewingResponse.status}, message=${reviewingPayload.message}`,
      "Admin debe poder pasar la disputa a reviewing"
    );

    const buyerDisputeDetailResponse = await request(`/disputes/${disputeId}`, {
      headers: { cookie: buyerCookie },
    });
    const buyerDisputeDetailHtml = normalizeHtml(await buyerDisputeDetailResponse.text());
    recordCase(
      results,
      "buyer_ve_reembolso_en_revision",
      "critical",
      buyerDisputeDetailResponse.status === 200 &&
        buyerDisputeDetailHtml.includes("Resultado postventa") &&
        buyerDisputeDetailHtml.includes("Reembolso en revision"),
      `status=${buyerDisputeDetailResponse.status}`,
      "La disputa buyer debe reflejar cuando el caso ya esta en revision"
    );

    const adminDisputeDetailResponse = await request(`/admin/disputes/${disputeId}`, {
      headers: { cookie: adminCookie },
    });
    const adminDisputeDetailHtml = normalizeHtml(await adminDisputeDetailResponse.text());
    recordCase(
      results,
      "admin_ve_accion_de_refund_en_caso",
      "critical",
      adminDisputeDetailResponse.status === 200 &&
        adminDisputeDetailHtml.includes("Emitir reembolso y cerrar caso") &&
        adminDisputeDetailHtml.includes("Resultado postventa"),
      `status=${adminDisputeDetailResponse.status}`,
      "Admin debe ver la accion economica sobre el caso"
    );

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
      "admin_puede_emitir_refund_operativo",
      "critical",
      refundResponse.status === 200 &&
        refundPayload.message === "Reembolso emitido y disputa cerrada correctamente",
      `status=${refundResponse.status}, message=${refundPayload.message}`,
      "Admin debe poder emitir refund y cerrar el caso"
    );

    const { data: refundedOrder } = await adminSupabase
      .from("orders")
      .select("status")
      .eq("id", purchase.order.id)
      .maybeSingle();
    const { data: revokedLicense } = await adminSupabase
      .from("licenses")
      .select("status")
      .eq("id", purchase.license.id)
      .maybeSingle();
    const { data: resolvedDispute } = await adminSupabase
      .from("disputes")
      .select("status")
      .eq("id", disputeId)
      .maybeSingle();
    recordCase(
      results,
      "refund_alinea_pedido_licencia_y_disputa",
      "critical",
      refundedOrder?.status === "refunded" &&
        revokedLicense?.status === "revoked" &&
        resolvedDispute?.status === "resolved",
      `order=${refundedOrder?.status || "missing"}, license=${revokedLicense?.status || "missing"}, dispute=${resolvedDispute?.status || "missing"}`,
      "Refund debe alinear pedido, licencia y disputa"
    );

    const buyerOrdersRefundedResponse = await request(`/orders?highlightOrder=${purchase.order.id}`, {
      headers: { cookie: buyerCookie },
    });
    const buyerOrdersRefundedHtml = normalizeHtml(await buyerOrdersRefundedResponse.text());
    recordCase(
      results,
      "buyer_ve_resultado_de_refund_en_orders",
      "critical",
      buyerOrdersRefundedResponse.status === 200 &&
        buyerOrdersRefundedHtml.includes("Reembolso emitido"),
      `status=${buyerOrdersRefundedResponse.status}`,
      "Orders debe reflejar el resultado visible del refund"
    );

    const buyerLicensesResponse = await request("/licenses", {
      headers: { cookie: buyerCookie },
    });
    const buyerLicensesHtml = normalizeHtml(await buyerLicensesResponse.text());
    recordCase(
      results,
      "buyer_ve_licencia_revocada_tras_refund",
      "high",
      buyerLicensesResponse.status === 200 &&
        buyerLicensesHtml.includes(product.title) &&
        buyerLicensesHtml.includes("Licencia revocada"),
      `status=${buyerLicensesResponse.status}`,
      "La biblioteca/licencias debe reflejar el estado posterior al refund"
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
