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
  throw new Error("Faltan variables de entorno de Supabase para la QA buyer post-sale transparency.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.BUYER_POSTSALE_TRANSPARENCY_QA_PORT || 3226);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const QA_PASSWORD = "ForjaDevQA!2026";
const BUYER_EMAIL = "qa-postsale-transparency-buyer@forjadev.local";
const SELLER_EMAIL = "qa-postsale-transparency-seller@forjadev.local";

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
  throw new Error("No se pudo iniciar el servidor local para la QA buyer post-sale transparency.");
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
      `No se pudo iniciar el servidor local para la QA buyer post-sale transparency. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA Transparency Seller",
        slug: `qa-transparency-${Date.now()}`,
        bio: "QA seller for buyer post-sale transparency.",
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

async function createApprovedProduct(vendorId, title, slug, refundPolicy) {
  const { data: product, error } = await adminSupabase
    .from("products")
    .insert([
      {
        vendor_id: vendorId,
        title,
        slug,
        short_description: `${title} QA post-sale transparency.`,
        description: `${title} QA post-sale transparency.`,
        price_cents: 3200,
        is_free: false,
        moderation_status: "approved",
        refund_policy: refundPolicy,
      },
    ])
    .select("id, vendor_id, title, slug, refund_policy")
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
    contents: Buffer.from("PK-QA-POSTSALE-TRANSPARENCY"),
  });

  const { error: fileError } = await adminSupabase.from("product_files").insert([
    {
      product_version_id: version.id,
      storage_path: filePath,
      file_name: `${slug}.zip`,
      file_size_bytes: Buffer.byteLength("PK-QA-POSTSALE-TRANSPARENCY"),
    },
  ]);

  if (fileError) {
    throw fileError;
  }

  return product;
}

async function createOrderWithLicense({ buyerUserId, productId, totalCents = 3200 }) {
  const { data: order, error: orderError } = await adminSupabase
    .from("orders")
    .insert([
      {
        user_id: buyerUserId,
        status: "completed",
        total_cents: totalCents,
      },
    ])
    .select("id, created_at, status")
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
        license_key: `QA-TRUST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: "active",
      },
    ])
    .select("id, status, license_key")
    .single();

  if (licenseError || !license) {
    throw licenseError || new Error("No se pudo crear la licencia QA.");
  }

  return { order, orderItem, license };
}

async function createDownload({ buyerUserId, productId }) {
  const { error } = await adminSupabase.from("downloads").insert([
    {
      user_id: buyerUserId,
      product_id: productId,
    },
  ]);

  if (error) {
    throw error;
  }
}

async function createSupportTicket({ buyerUserId, vendorId, productId, subject, status = "waiting_seller" }) {
  const now = new Date().toISOString();
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
        last_message_at: now,
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
      body: "QA message for post-sale transparency.",
    },
  ]);

  if (messageError) {
    throw messageError;
  }

  return ticket;
}

async function createDispute({ buyerUserId, orderId, productId, licenseId, status = "reviewing", reason }) {
  const { data: dispute, error } = await adminSupabase
    .from("disputes")
    .insert([
      {
        order_id: orderId,
        product_id: productId,
        license_id: licenseId,
        opened_by_user_id: buyerUserId,
        status,
        reason,
      },
    ])
    .select("id, status")
    .single();

  if (error || !dispute) {
    throw error || new Error("No se pudo crear la disputa QA.");
  }

  return dispute;
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
      displayName: "QA Transparency Buyer",
      username: "qa_transparency_buyer",
    });
    const sellerUser = await ensureUser({
      email: SELLER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Transparency Seller",
      username: "qa_transparency_seller",
    });
    const vendor = await ensureVendor(sellerUser.id);

    const seed = Date.now();
    const activeProduct = await createApprovedProduct(
      vendor.id,
      `QA Transparency Active ${seed}`,
      `qa-transparency-active-${seed}`,
      "Si el acceso funciona y soporte responde, no procede reembolso."
    );
    const supportProduct = await createApprovedProduct(
      vendor.id,
      `QA Transparency Support ${seed}`,
      `qa-transparency-support-${seed}`,
      "Primero se evalua soporte y luego, si hace falta, la revision administrativa."
    );
    const refundedProduct = await createApprovedProduct(
      vendor.id,
      `QA Transparency Refunded ${seed}`,
      `qa-transparency-refunded-${seed}`,
      "Si el marketplace concede reembolso, el pedido pasa a historico postventa sin acceso activo."
    );

    const activePurchase = await createOrderWithLicense({
      buyerUserId: buyerUser.id,
      productId: activeProduct.id,
    });
    await createDownload({ buyerUserId: buyerUser.id, productId: activeProduct.id });

    const supportPurchase = await createOrderWithLicense({
      buyerUserId: buyerUser.id,
      productId: supportProduct.id,
    });
    const supportTicket = await createSupportTicket({
      buyerUserId: buyerUser.id,
      vendorId: vendor.id,
      productId: supportProduct.id,
      subject: "QA Transparency support case",
      status: "waiting_seller",
    });
    const dispute = await createDispute({
      buyerUserId: buyerUser.id,
      orderId: supportPurchase.order.id,
      productId: supportProduct.id,
      licenseId: supportPurchase.license.id,
      status: "reviewing",
      reason: "QA dispute to verify buyer-facing post-sale transparency.",
    });

    const refundedPurchase = await createOrderWithLicense({
      buyerUserId: buyerUser.id,
      productId: refundedProduct.id,
    });
    const { error: refundOrderError } = await adminSupabase
      .from("orders")
      .update({ status: "refunded" })
      .eq("id", refundedPurchase.order.id);
    if (refundOrderError) throw refundOrderError;

    const { error: revokeLicenseError } = await adminSupabase
      .from("licenses")
      .update({ status: "revoked" })
      .eq("id", refundedPurchase.license.id);
    if (revokeLicenseError) throw revokeLicenseError;

    const buyerCookies = await login(BUYER_EMAIL, QA_PASSWORD);

    const ordersResponse = await request(`/orders?highlightOrder=${activePurchase.order.id}`, {
      headers: { cookie: buyerCookies },
    });
    const ordersHtml = normalizeHtml(await ordersResponse.text());
    recordCase(
      results,
      "orders_muestra_claridad_postventa",
      "critical",
      ordersResponse.status === 200 &&
        ordersHtml.includes('data-postsale-clarity="buyer"') &&
        ordersHtml.includes('data-postsale-stage="redownload_ready"') &&
        ordersHtml.includes('data-postsale-stage="refunded"'),
      `status=${ordersResponse.status}`,
      "La vista /orders debe mostrar claridad compartida para estados activos y reembolsados"
    );

    const licensesResponse = await request("/licenses", {
      headers: { cookie: buyerCookies },
    });
    const licensesHtml = normalizeHtml(await licensesResponse.text());
    recordCase(
      results,
      "licenses_muestra_biblioteca_mas_transparente",
      "critical",
      licensesResponse.status === 200 &&
        licensesHtml.includes('data-postsale-clarity="buyer"') &&
        licensesHtml.includes("Pedido reembolsado") &&
        (licensesHtml.includes('data-postsale-stage="redownload_ready"') ||
          licensesHtml.includes('data-postsale-stage="download_ready"')),
      `status=${licensesResponse.status}`,
      "La biblioteca debe explicar ownership activo y tambien el historico reembolsado"
    );

    const supportResponse = await request("/support?view=buyer", {
      headers: { cookie: buyerCookies },
    });
    const supportHtml = normalizeHtml(await supportResponse.text());
    recordCase(
      results,
      "support_queue_explica_siguiente_paso_con_claridad",
      "critical",
      supportResponse.status === 200 &&
        supportHtml.includes('data-postsale-stage="dispute_reviewing"') &&
        supportHtml.includes("Siguiente paso:"),
      `status=${supportResponse.status}`,
      "La cola de soporte debe explicar si el caso sigue en soporte o ya esta bajo revision administrativa"
    );

    const supportTicketResponse = await request(`/support/tickets/${supportTicket.id}`, {
      headers: { cookie: buyerCookies },
    });
    const supportTicketHtml = normalizeHtml(await supportTicketResponse.text());
    recordCase(
      results,
      "support_detail_une_estado_y_expectativa",
      "critical",
      supportTicketResponse.status === 200 &&
        supportTicketHtml.includes('data-postsale-stage="dispute_reviewing"') &&
        supportTicketHtml.includes("Que puedes esperar:"),
      `status=${supportTicketResponse.status}`,
      "El detalle de soporte debe explicar que significa el estado y que puede esperar el buyer"
    );

    const disputesResponse = await request("/disputes", {
      headers: { cookie: buyerCookies },
    });
    const disputesHtml = normalizeHtml(await disputesResponse.text());
    recordCase(
      results,
      "disputes_queue_refuerza_transparencia",
      "critical",
      disputesResponse.status === 200 &&
        disputesHtml.includes('data-postsale-stage="dispute_reviewing"') &&
        disputesHtml.includes("Siguiente paso:"),
      `status=${disputesResponse.status}`,
      "La bandeja de disputas debe reforzar el estado y la accion esperada"
    );

    const disputeDetailResponse = await request(`/disputes/${dispute.id}`, {
      headers: { cookie: buyerCookies },
    });
    const disputeDetailHtml = normalizeHtml(await disputeDetailResponse.text());
    recordCase(
      results,
      "dispute_detail_es_claro_y_seguro",
      "critical",
      disputeDetailResponse.status === 200 &&
        disputeDetailHtml.includes('data-postsale-stage="dispute_reviewing"') &&
        disputeDetailHtml.includes("Que puedes esperar:") &&
        !disputeDetailHtml.includes("license_id") &&
        !disputeDetailHtml.includes("product_id"),
      `status=${disputeDetailResponse.status}`,
      "El detalle de disputa debe ser claro para el buyer sin filtrar identificadores internos"
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      throw new Error(
        `QA buyer post-sale transparency con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
