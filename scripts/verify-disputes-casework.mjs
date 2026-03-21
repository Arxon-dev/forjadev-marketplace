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
  throw new Error("Faltan variables de entorno de Supabase para la QA disputes casework.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.DISPUTES_CASEWORK_QA_PORT || 3220);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const QA_PASSWORD = "ForjaDevQA!2026";
const BUYER_EMAIL = "qa-disputes-buyer@forjadev.local";
const EMPTY_BUYER_EMAIL = "qa-disputes-empty@forjadev.local";
const OTHER_BUYER_EMAIL = "qa-disputes-other@forjadev.local";
const SELLER_EMAIL = "qa-disputes-seller@forjadev.local";
const ADMIN_EMAIL = "qa-disputes-admin@forjadev.local";

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
  throw new Error("No se pudo iniciar el servidor local para la QA disputes casework.");
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
      `No se pudo iniciar el servidor local para la QA disputes casework. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA Disputes Seller",
        slug: `qa-disputes-${Date.now()}`,
        bio: "QA disputes store",
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
        title: `QA Dispute Product ${seed}`,
        slug: `qa-dispute-product-${seed}`,
        short_description: "Producto QA disputes casework.",
        description: "Producto QA disputes casework.",
        price_cents: 3100,
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
        changelog: "Release activa QA disputes casework.",
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
    fileName: "qa-disputes.zip",
    contents: Buffer.from("PK-QA-DISPUTES"),
  });

  const { error: fileError } = await adminSupabase.from("product_files").insert([
    {
      product_version_id: version.id,
      storage_path: filePath,
      file_name: "qa-disputes.zip",
      file_size_bytes: Buffer.byteLength("PK-QA-DISPUTES"),
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
        total_cents: 3100,
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
        price_cents: 3100,
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
        license_key: `QA-DSP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
        subject: "QA disputa relacionada",
        status: "waiting_seller",
        priority: "high",
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
      body: "Necesito ayuda con este pedido antes de escalar.",
    },
  ]);

  if (messageError) {
    throw messageError;
  }

  await adminSupabase
    .from("support_tickets")
    .update({
      status: "waiting_seller",
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    .eq("id", ticket.id);

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
      displayName: "QA Disputes Buyer",
      username: "qa_disputes_buyer",
    });
    const emptyBuyerUser = await ensureUser({
      email: EMPTY_BUYER_EMAIL,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Disputes Empty",
      username: "qa_disputes_empty",
    });
    const otherBuyerUser = await ensureUser({
      email: OTHER_BUYER_EMAIL,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Disputes Other",
      username: "qa_disputes_other",
    });
    const sellerUser = await ensureUser({
      email: SELLER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Disputes Seller",
      username: "qa_disputes_seller",
    });
    await ensureUser({
      email: ADMIN_EMAIL,
      password: QA_PASSWORD,
      role: "admin",
      displayName: "QA Disputes Admin",
      username: "qa_disputes_admin",
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
    const emptyBuyerCookie = await login(EMPTY_BUYER_EMAIL, QA_PASSWORD);
    const otherBuyerCookie = await login(OTHER_BUYER_EMAIL, QA_PASSWORD);
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
        reason: "QA disputa buyer/admin para validar casework completo.",
      }),
    });
    const createDisputePayload = await createDisputeResponse.json().catch(() => ({}));
    if (!createDisputeResponse.ok || !createDisputePayload.disputeId) {
      throw new Error(
        `No se pudo crear la disputa QA: status=${createDisputeResponse.status} message=${createDisputePayload.message}`
      );
    }
    const disputeId = createDisputePayload.disputeId;

    const anonymousResponse = await request("/disputes");
    recordCase(
      results,
      "anonimo_bloqueado_en_disputes",
      "critical",
      anonymousResponse.status >= 300 &&
        anonymousResponse.status < 400 &&
        (anonymousResponse.headers.get("location") || "").includes("/login"),
      `status=${anonymousResponse.status}, location=${anonymousResponse.headers.get("location")}`,
      "Debe redirigir a /login"
    );

    const buyerQueueResponse = await request("/disputes", {
      headers: { cookie: buyerCookie },
    });
    const buyerQueueHtml = normalizeHtml(await buyerQueueResponse.text());
    recordCase(
      results,
      "buyer_ve_bandeja_util_de_disputas",
      "critical",
      buyerQueueResponse.status === 200 &&
        buyerQueueHtml.includes("Tus disputas") &&
        buyerQueueHtml.includes(product.title) &&
        buyerQueueHtml.includes("Siguiente accion") &&
        buyerQueueHtml.includes(`/disputes/${disputeId}`) &&
        buyerQueueHtml.includes(`/orders?highlightOrder=${purchase.order.id}`),
      `status=${buyerQueueResponse.status}`,
      "La bandeja buyer debe mostrar estado, accion y continuidad"
    );

    const buyerDetailResponse = await request(`/disputes/${disputeId}`, {
      headers: { cookie: buyerCookie },
    });
    const buyerDetailHtml = normalizeHtml(await buyerDetailResponse.text());
    const leakedLicenseIndex = buyerDetailHtml.indexOf(purchase.license.id);
    const buyerDetailChecks = {
      timeline: buyerDetailHtml.includes("Timeline del caso"),
      context: buyerDetailHtml.includes("Contexto operativo"),
      ticketCta: buyerDetailHtml.includes("Ver ticket relacionado"),
      hiddenInternalLicenseId: buyerDetailHtml.includes(purchase.license.id) === false,
      hiddenInternalProductId: buyerDetailHtml.includes(product.id) === false,
      reason: buyerDetailHtml.includes("QA disputa buyer/admin para validar casework completo."),
      supportHref: buyerDetailHtml.includes(`/support/tickets/${ticket.id}`),
    };
    recordCase(
      results,
      "buyer_ve_detalle_util_de_disputa",
      "critical",
      buyerDetailResponse.status === 200 &&
        buyerDetailChecks.timeline &&
        buyerDetailChecks.context &&
        buyerDetailChecks.ticketCta &&
        buyerDetailChecks.hiddenInternalLicenseId &&
        buyerDetailChecks.hiddenInternalProductId &&
        buyerDetailChecks.reason &&
        buyerDetailChecks.supportHref,
      `status=${buyerDetailResponse.status}, checks=${JSON.stringify(buyerDetailChecks)}, leakSnippet=${
        leakedLicenseIndex >= 0
          ? buyerDetailHtml.slice(Math.max(0, leakedLicenseIndex - 80), leakedLicenseIndex + purchase.license.id.length + 80)
          : "none"
      }`,
      "El detalle buyer debe unir disputa, pedido, licencia, soporte y timeline"
    );

    const emptyBuyerResponse = await request("/disputes", {
      headers: { cookie: emptyBuyerCookie },
    });
    const emptyBuyerHtml = normalizeHtml(await emptyBuyerResponse.text());
    recordCase(
      results,
      "buyer_sin_disputas_ve_empty_state_claro",
      "high",
      emptyBuyerResponse.status === 200 && emptyBuyerHtml.includes("Todavia no has abierto disputas."),
      `status=${emptyBuyerResponse.status}`,
      "Debe existir empty state claro"
    );

    const otherBuyerDetailResponse = await request(`/disputes/${disputeId}`, {
      headers: { cookie: otherBuyerCookie },
    });
    recordCase(
      results,
      "buyer_ajeno_no_ve_disputa_ajena",
      "critical",
      otherBuyerDetailResponse.status === 404,
      `status=${otherBuyerDetailResponse.status}`,
      "Un buyer ajeno no debe acceder al caso"
    );

    const adminDetailResponse = await request(`/admin/disputes/${disputeId}`, {
      headers: { cookie: adminCookie },
    });
    const adminDetailHtml = normalizeHtml(await adminDetailResponse.text());
    recordCase(
      results,
      "admin_ve_detalle_operativo_de_disputa",
      "critical",
      adminDetailResponse.status === 200 &&
        adminDetailHtml.includes("Dispute Ops") &&
        adminDetailHtml.includes("Acciones") &&
        adminDetailHtml.includes("Timeline del caso") &&
        adminDetailHtml.includes(`/support/tickets/${ticket.id}`),
      `status=${adminDetailResponse.status}`,
      "Admin debe tener detalle operativo real"
    );

    const nonAdminAdminDetailResponse = await request(`/admin/disputes/${disputeId}`, {
      headers: { cookie: buyerCookie },
    });
    recordCase(
      results,
      "buyer_no_admin_bloqueado_en_admin_dispute_detail",
      "critical",
      nonAdminAdminDetailResponse.status >= 300 &&
        nonAdminAdminDetailResponse.status < 400 &&
        (nonAdminAdminDetailResponse.headers.get("location") || "").includes("/dashboard"),
      `status=${nonAdminAdminDetailResponse.status}, location=${nonAdminAdminDetailResponse.headers.get("location")}`,
      "El no admin debe ser redirigido fuera del backoffice"
    );

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
      "admin_puede_tomar_revision",
      "critical",
      reviewingResponse.status === 200 &&
        reviewingPayload.message === "Disputa actualizada correctamente",
      `status=${reviewingResponse.status}, message=${reviewingPayload.message}`,
      "Admin debe poder pasar open -> reviewing"
    );

    const resolvedResponse = await request(`/api/admin/disputes/${disputeId}/status`, {
      method: "POST",
      headers: {
        cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "resolved" }),
    });
    const resolvedPayload = await resolvedResponse.json().catch(() => ({}));
    recordCase(
      results,
      "admin_puede_resolver_disputa",
      "critical",
      resolvedResponse.status === 200 &&
        resolvedPayload.message === "Disputa actualizada correctamente",
      `status=${resolvedResponse.status}, message=${resolvedPayload.message}`,
      "Admin debe poder resolver reviewing -> resolved"
    );

    const buyerResolvedDetailResponse = await request(`/disputes/${disputeId}`, {
      headers: { cookie: buyerCookie },
    });
    const buyerResolvedDetailHtml = normalizeHtml(await buyerResolvedDetailResponse.text());
    const { data: resolvedDispute } = await adminSupabase
      .from("disputes")
      .select("status")
      .eq("id", disputeId)
      .maybeSingle();
    recordCase(
      results,
      "buyer_ve_resolucion_visible_y_timeline_actualizado",
      "critical",
      buyerResolvedDetailResponse.status === 200 &&
        buyerResolvedDetailHtml.includes("Timeline del caso") &&
        resolvedDispute?.status === "resolved",
      `status=${buyerResolvedDetailResponse.status}, dbStatus=${resolvedDispute?.status || "unknown"}`,
      "El buyer debe ver la resolucion y la trazabilidad del caso"
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
