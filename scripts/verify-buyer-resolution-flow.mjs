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
  throw new Error("Faltan variables de entorno de Supabase para la QA buyer resolution.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.BUYER_RESOLUTION_QA_PORT || 3218);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const QA_PASSWORD = "ForjaDevQA!2026";
const BUYER_EMAIL = "qa-buyer-resolution@forjadev.local";
const EMPTY_BUYER_EMAIL = "qa-buyer-resolution-empty@forjadev.local";
const SELLER_EMAIL = "qa-buyer-resolution-seller@forjadev.local";

function getCookieHeaderFromResponse(response) {
  const setCookies = response.headers.getSetCookie?.() || [];
  return setCookies.map((value) => value.split(";")[0]).join("; ");
}

function normalizeHtml(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();
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
  throw new Error("No se pudo iniciar el servidor local para la QA buyer resolution.");
}

async function startServer() {
  let stderr = "";
  let stdout = "";
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
  } catch (error) {
    child.kill("SIGTERM");
    throw new Error(
      `No se pudo iniciar el servidor local para la QA buyer resolution. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA Buyer Resolution Store",
        slug: `qa-buyer-resolution-${Date.now()}`,
        bio: "QA Buyer Resolution Store",
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
        short_description: "Producto QA buyer resolution.",
        description: "Producto QA buyer resolution.",
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
        changelog: "Release activa QA buyer resolution.",
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
    fileName: "qa-buyer-resolution.zip",
    contents: Buffer.from("PK-QA-BUYER-RESOLUTION"),
  });

  const { error: fileError } = await adminSupabase.from("product_files").insert([
    {
      product_version_id: version.id,
      storage_path: filePath,
      file_name: "qa-buyer-resolution.zip",
      file_size_bytes: Buffer.byteLength("PK-QA-BUYER-RESOLUTION"),
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
        status: "completed",
        total_cents: totalCents,
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
        license_key: `QA-RES-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

async function createTicket({
  buyerUserId,
  vendorId,
  productId,
  subject,
  status,
  priority,
  message,
}) {
  const { data: ticket, error: ticketError } = await adminSupabase
    .from("support_tickets")
    .insert([
      {
        product_id: productId,
        vendor_id: vendorId,
        buyer_user_id: buyerUserId,
        subject,
        status,
        priority,
      },
    ])
    .select("id, last_message_at")
    .single();

  if (ticketError || !ticket) {
    throw ticketError || new Error("No se pudo crear el ticket QA.");
  }

  const { error: messageError } = await adminSupabase.from("support_messages").insert([
    {
      ticket_id: ticket.id,
      sender_user_id: buyerUserId,
      body: message,
    },
  ]);

  if (messageError) {
    throw messageError;
  }

  await adminSupabase
    .from("support_tickets")
    .update({
      status,
      updated_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    .eq("id", ticket.id);

  return ticket;
}

async function createDispute({ buyerUserId, orderId, productId, licenseId, reason, status = "open" }) {
  const { data: dispute, error } = await adminSupabase
    .from("disputes")
    .insert([
      {
        opened_by_user_id: buyerUserId,
        order_id: orderId,
        product_id: productId,
        license_id: licenseId,
        reason,
        status,
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
      displayName: "QA Buyer Resolution",
      username: "qa_buyer_resolution",
    });
    const emptyBuyerUser = await ensureUser({
      email: EMPTY_BUYER_EMAIL,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Buyer Resolution Empty",
      username: "qa_buyer_resolution_empty",
    });
    const sellerUser = await ensureUser({
      email: SELLER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Buyer Resolution Seller",
      username: "qa_buyer_resolution_seller",
    });

    const vendor = await ensureVendor(sellerUser.id);
    const disputedProduct = await createApprovedProduct(vendor.id, "QA Resolution Disputed", "qa-resolution-disputed");
    const closedProduct = await createApprovedProduct(vendor.id, "QA Resolution Closed", "qa-resolution-closed");
    const lockedProduct = await createApprovedProduct(vendor.id, "QA Resolution Locked", "qa-resolution-locked");

    const disputedPurchase = await createCompletedOrder({
      buyerUserId: buyerUser.id,
      productId: disputedProduct.id,
      totalCents: 2400,
      licenseStatus: "active",
    });
    const closedPurchase = await createCompletedOrder({
      buyerUserId: buyerUser.id,
      productId: closedProduct.id,
      totalCents: 2400,
      licenseStatus: "active",
    });

    const openTicket = await createTicket({
      buyerUserId: buyerUser.id,
      vendorId: vendor.id,
      productId: disputedProduct.id,
      subject: "QA ticket esperando seller",
      status: "waiting_seller",
      priority: "high",
      message: "El buyer necesita ayuda y aun espera respuesta.",
    });

    const closedTicket = await createTicket({
      buyerUserId: buyerUser.id,
      vendorId: vendor.id,
      productId: closedProduct.id,
      subject: "QA ticket cerrado",
      status: "closed",
      priority: "normal",
      message: "Caso cerrado que podria escalarse si persiste.",
    });

    await createDispute({
      buyerUserId: buyerUser.id,
      orderId: disputedPurchase.order.id,
      productId: disputedProduct.id,
      licenseId: disputedPurchase.license.id,
      reason: "QA dispute abierta para producto con incidencia.",
      status: "open",
    });

    const buyerCookie = await login(BUYER_EMAIL, QA_PASSWORD);
    const emptyBuyerCookie = await login(EMPTY_BUYER_EMAIL, QA_PASSWORD);

    const anonymousSupportResponse = await request("/support");
    recordCase(
      results,
      "anonimo_bloqueado_en_support",
      "critical",
      anonymousSupportResponse.status >= 300 &&
        anonymousSupportResponse.status < 400 &&
        (anonymousSupportResponse.headers.get("location") || "").includes("/login"),
      `status=${anonymousSupportResponse.status}, location=${anonymousSupportResponse.headers.get("location")}`,
      "Debe redirigir a /login"
    );

    const supportResponse = await request(`/support?view=buyer&product=${disputedProduct.id}`, {
      headers: { cookie: buyerCookie },
    });
    const supportHtml = normalizeHtml(await supportResponse.text());

    recordCase(
      results,
      "buyer_ve_tickets_y_estado_de_resolucion",
      "critical",
      supportResponse.status === 200 &&
        supportHtml.includes("Centro de soporte y resolucion") &&
        supportHtml.includes("QA ticket esperando seller") &&
        supportHtml.includes("QA ticket cerrado") &&
        supportHtml.includes("Espera respuesta del seller") &&
        (supportHtml.includes("Ticket cerrado. Reabre o escala si sigue sin resolverse") ||
          supportHtml.includes("Ticket cerrado. Reabre o escala si el problema persiste")),
      `status=${supportResponse.status}`,
      "El buyer debe ver tickets, estado y siguiente accion"
    );

    recordCase(
      results,
      "buyer_ve_disputa_activa_y_continuidad",
      "critical",
      supportHtml.includes("Disputa abierta") &&
        supportHtml.includes(`/orders?highlightOrder=${disputedPurchase.order.id}`) &&
        supportHtml.includes(`/support/tickets/${openTicket.id}`),
      "HTML incluye disputa y continuidad contextual",
      "Soporte debe enlazar con pedido y escalado"
    );

    const closedTicketResponse = await request(`/support/tickets/${closedTicket.id}`, {
      headers: { cookie: buyerCookie },
    });
    const closedTicketHtml = normalizeHtml(await closedTicketResponse.text());
    recordCase(
      results,
      "buyer_ve_detalle_y_posibilidad_de_escalar",
      "critical",
      closedTicketResponse.status === 200 &&
        closedTicketHtml.includes("Escalado administrativo") &&
        closedTicketHtml.includes("Abrir disputa") &&
        closedTicketHtml.includes("Ver pedido"),
      `status=${closedTicketResponse.status}`,
      "El detalle del ticket debe permitir continuidad a disputa y pedido"
    );

    const openTicketResponse = await request(`/support/tickets/${openTicket.id}`, {
      headers: { cookie: buyerCookie },
    });
    const openTicketHtml = normalizeHtml(await openTicketResponse.text());
    recordCase(
      results,
      "buyer_ve_disputa_existente_en_detalle",
      "high",
      openTicketResponse.status === 200 &&
        openTicketHtml.includes("Disputa abierta") &&
        openTicketHtml.includes("Ver disputa"),
      `status=${openTicketResponse.status}`,
      "Cuando ya existe disputa, el detalle debe mostrarla"
    );

    const emptySupportResponse = await request("/support?view=buyer", {
      headers: { cookie: emptyBuyerCookie },
    });
    const emptySupportHtml = normalizeHtml(await emptySupportResponse.text());
    recordCase(
      results,
      "buyer_sin_tickets_ve_empty_state_claro",
      "high",
      emptySupportResponse.status === 200 &&
        emptySupportHtml.includes("Todavia no has abierto tickets."),
      `status=${emptySupportResponse.status}`,
      "Debe existir empty state claro para buyers sin tickets"
    );

    const lockedTicketAttempt = await request("/api/support/tickets", {
      method: "POST",
      headers: {
        cookie: buyerCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: lockedProduct.id,
        subject: "Intento sin compra",
        message: "No deberia permitirse",
        priority: "normal",
      }),
    });
    const lockedTicketPayload = await lockedTicketAttempt.json().catch(() => ({}));
    recordCase(
      results,
      "buyer_sin_acceso_no_puede_abrir_soporte",
      "critical",
      lockedTicketAttempt.status === 403 &&
        lockedTicketPayload.message === "Solo puedes abrir soporte para productos adquiridos",
      `status=${lockedTicketAttempt.status}, message=${lockedTicketPayload.message}`,
      "El buyer no debe abrir soporte sobre productos no poseidos"
    );

    const disputesResponse = await request("/disputes", {
      headers: { cookie: buyerCookie },
    });
    const disputesHtml = normalizeHtml(await disputesResponse.text());
    recordCase(
      results,
      "buyer_ve_bandeja_de_disputas",
      "high",
      disputesResponse.status === 200 &&
        disputesHtml.includes("Disputas") &&
        disputesHtml.includes(disputedProduct.title),
      `status=${disputesResponse.status}`,
      "La bandeja de disputas debe seguir disponible y coherente"
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
