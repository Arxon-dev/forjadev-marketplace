import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name, fallback) {
  const value = process.env[name] || fallback;

  if (!value) {
    throw new Error(`Falta la variable ${name}`);
  }

  return value;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();

  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { response, body };
}

async function signInBuyer({ supabaseUrl, anonKey, email, password }) {
  const url = new URL("/auth/v1/token?grant_type=password", supabaseUrl);

  return requestJson(url, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

async function ensureBuyer({
  supabaseUrl,
  anonKey,
  serviceRoleKey,
  email,
  password,
  allowWrite,
}) {
  const signInResult = await signInBuyer({ supabaseUrl, anonKey, email, password });

  if (signInResult.response.ok && signInResult.body?.access_token) {
    return signInResult.body;
  }

  if (!allowWrite) {
    throw new Error(
      "El buyer QA no existe o la password no coincide. Activa MARKETPLACE_QA_ALLOW_WRITE=1 para crearlo."
    );
  }

  const createUserUrl = new URL("/auth/v1/admin/users", supabaseUrl);
  const createUserResult = await requestJson(createUserUrl, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: "qa_buyer",
        display_name: "QA Buyer",
      },
    }),
  });

  if (!createUserResult.response.ok && createUserResult.response.status !== 422) {
    throw new Error(`No se pudo crear el buyer QA: HTTP ${createUserResult.response.status}`);
  }

  const retrySignIn = await signInBuyer({ supabaseUrl, anonKey, email, password });

  if (!retrySignIn.response.ok || !retrySignIn.body?.access_token) {
    throw new Error("No se pudo iniciar sesion con el buyer QA");
  }

  return retrySignIn.body;
}

async function fetchServiceRows(supabaseUrl, serviceRoleKey, path, params = {}) {
  const url = new URL(path, supabaseUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const { response, body } = await requestJson(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${url.pathname}`);
  }

  return body;
}

async function fetchUserRows(supabaseUrl, token, path, params = {}) {
  const url = new URL(path, supabaseUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const { response, body } = await requestJson(url, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${url.pathname}`);
  }

  return body;
}

async function findEligiblePaidProduct({ supabaseUrl, serviceRoleKey, buyerId }) {
  const products = await fetchServiceRows(supabaseUrl, serviceRoleKey, "/rest/v1/products", {
    select: "id,title,is_free,vendor_id,moderation_status",
    moderation_status: "eq.approved",
    is_free: "eq.false",
    limit: "25",
  });

  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("No hay productos de pago aprobados disponibles");
  }

  const vendorIds = Array.from(new Set(products.map((product) => product.vendor_id)));
  const vendors = await fetchServiceRows(supabaseUrl, serviceRoleKey, "/rest/v1/vendors", {
    select: "id,user_id",
    id: `in.(${vendorIds.join(",")})`,
  });

  const vendorOwnerById = new Map(vendors.map((vendor) => [vendor.id, vendor.user_id]));
  const product = products.find((item) => vendorOwnerById.get(item.vendor_id) !== buyerId);

  if (!product) {
    throw new Error("No hay productos de pago aprobados que no pertenezcan al buyer QA");
  }

  return product;
}

async function runLifecycle() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const qaEmail = requireEnv("MARKETPLACE_QA_EMAIL", "qa-buyer@forjadev.local");
  const qaPassword = requireEnv("MARKETPLACE_QA_PASSWORD", "ForjaDev_QA_2026!");
  const allowWrite = process.env.MARKETPLACE_QA_ALLOW_WRITE === "1";

  console.log(`Modo escritura: ${allowWrite ? "ON" : "OFF"}`);
  console.log(`Buyer QA: ${qaEmail}`);

  const buyerSession = await ensureBuyer({
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    email: qaEmail,
    password: qaPassword,
    allowWrite,
  });

  const buyerId = buyerSession.user.id;
  console.log(`Buyer autenticado: ${buyerId}`);

  const profiles = await fetchServiceRows(supabaseUrl, serviceRoleKey, "/rest/v1/profiles", {
    select: "id,email,role",
    id: `eq.${buyerId}`,
  });

  if (!Array.isArray(profiles) || profiles.length !== 1) {
    const ensureUrl = new URL("/rest/v1/rpc/ensure_profile_exists", supabaseUrl);
    const ensureResult = await requestJson(ensureUrl, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${buyerSession.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!ensureResult.response.ok) {
      throw new Error("El perfil del buyer QA no existe");
    }
  }

  const repairedProfiles = await fetchServiceRows(supabaseUrl, serviceRoleKey, "/rest/v1/profiles", {
    select: "id,email,role",
    id: `eq.${buyerId}`,
  });

  if (!Array.isArray(repairedProfiles) || repairedProfiles.length !== 1) {
    throw new Error("El perfil del buyer QA no existe");
  }

  console.log(`Perfil OK: role=${repairedProfiles[0].role}`);

  const product = await findEligiblePaidProduct({
    supabaseUrl,
    serviceRoleKey,
    buyerId,
  });

  console.log(`Producto objetivo: ${product.title} (${product.id})`);

  const existingOrders = await fetchServiceRows(
    supabaseUrl,
    serviceRoleKey,
    "/rest/v1/order_items",
    {
      select: "id,order:orders!inner(id,status,user_id),product_id",
      product_id: `eq.${product.id}`,
      "order.user_id": `eq.${buyerId}`,
      "order.status": "eq.completed",
    }
  );

  let orderCreatedNow = false;
  let createdOrderId = null;

  if (!Array.isArray(existingOrders) || existingOrders.length === 0) {
    if (!allowWrite) {
      throw new Error(
        "No existe compra previa para el buyer QA. Activa MARKETPLACE_QA_ALLOW_WRITE=1 para crearla."
      );
    }

    const rpcUrl = new URL("/rest/v1/rpc/create_checkout_order", supabaseUrl);
    const { response, body } = await requestJson(rpcUrl, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${buyerSession.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_product_id: product.id,
      }),
    });

    if (!response.ok) {
      throw new Error(`El checkout RPC fallo: ${JSON.stringify(body)}`);
    }

    orderCreatedNow = true;
    createdOrderId = body?.[0]?.order_id || null;
    console.log(`Checkout ejecutado: ${createdOrderId || "sin order id"}`);
  } else {
    console.log("Compra previa encontrada, no se crea una nueva orden");
  }

  const orderItems = await fetchServiceRows(supabaseUrl, serviceRoleKey, "/rest/v1/order_items", {
    select: "id,order_id,price_cents,created_at,order:orders!inner(id,status,user_id)",
    product_id: `eq.${product.id}`,
    "order.user_id": `eq.${buyerId}`,
    "order.status": "eq.completed",
  });

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    throw new Error("No se encontro ninguna order_item completada para el producto objetivo");
  }

  const licenses = await fetchUserRows(
    supabaseUrl,
    buyerSession.access_token,
    "/rest/v1/licenses",
    {
      select: "id,product_id,status,license_key,issued_at",
      product_id: `eq.${product.id}`,
    }
  );

  if (!Array.isArray(licenses) || licenses.length !== 1) {
    throw new Error(`Se esperaba exactamente 1 licencia visible y se obtuvieron ${licenses?.length ?? 0}`);
  }

  if (licenses[0].status !== "active") {
    throw new Error(`La licencia visible no esta activa: ${licenses[0].status}`);
  }

  console.log(`Licencia OK: ${licenses[0].license_key}`);

  const duplicateRpcUrl = new URL("/rest/v1/rpc/create_checkout_order", supabaseUrl);
  const duplicateResult = await requestJson(duplicateRpcUrl, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${buyerSession.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_product_id: product.id,
    }),
  });

  if (duplicateResult.response.ok) {
    throw new Error("El checkout duplicado deberia fallar y no lo hizo");
  }

  if (duplicateResult.body?.message !== "Ya tienes este producto en tu biblioteca") {
    throw new Error("El checkout duplicado no devolvio el mensaje esperado");
  }

  console.log("Proteccion de compra duplicada OK");

  const auditParams = {
    select: "id,action,entity_type,entity_id,created_at",
    entity_type: "eq.order",
    action: "eq.checkout.completed",
    order: "created_at.desc",
    limit: "5",
  };
  const auditLogs = await fetchServiceRows(
    supabaseUrl,
    serviceRoleKey,
    "/rest/v1/audit_logs",
    auditParams
  );

  if (orderCreatedNow) {
    const matchingLog = Array.isArray(auditLogs)
      ? auditLogs.find((log) => log.entity_id === createdOrderId)
      : null;

    if (!matchingLog) {
      throw new Error("No se encontro el audit log esperado para la orden creada");
    }
  }

  console.log(`Audit logs de checkout disponibles: ${Array.isArray(auditLogs) ? auditLogs.length : 0}`);
  console.log(orderCreatedNow ? "Verificacion completa con escritura" : "Verificacion completa en modo seguro");
}

runLifecycle().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
