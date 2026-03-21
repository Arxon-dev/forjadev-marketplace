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
  throw new Error("Faltan variables de entorno de Supabase para la QA bundles commercial block.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.BUNDLES_COMMERCIAL_BLOCK_QA_PORT || 3235);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const QA_PASSWORD = "ForjaDevQA!2026";
const SELLER_EMAIL = "qa-bundles-seller@forjadev.local";
const BUYER_EMAIL = "qa-bundles-buyer@forjadev.local";

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
      const response = await fetch(`${BASE_URL}/bundles`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("No se pudo iniciar el servidor local para la QA bundles commercial block.");
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
      `No se pudo iniciar el servidor local para la QA bundles commercial block. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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

async function ensureVendor(userId, seed) {
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
        store_name: "QA Bundles Seller",
        slug: `qa-bundles-seller-${seed}`,
        bio: "QA seller for bundles commercial block.",
      },
    ])
    .select("id")
    .single();

  if (error || !vendor) {
    throw error || new Error("No se pudo crear el vendor QA bundles.");
  }

  return vendor;
}

async function createCategory({ name, slug, sortOrder = 100 }) {
  const { data: category, error } = await adminSupabase
    .from("categories")
    .insert([
      {
        name,
        slug,
        description: `${name} QA bundles.`,
        is_active: true,
        sort_order: sortOrder,
      },
    ])
    .select("id, name, slug")
    .single();

  if (error || !category) {
    throw error || new Error(`No se pudo crear la categoria ${name}.`);
  }

  return category;
}

async function createGame({ name, slug, sortOrder = 100 }) {
  const { data: game, error } = await adminSupabase
    .from("games")
    .insert([
      {
        name,
        slug,
        is_active: true,
        sort_order: sortOrder,
      },
    ])
    .select("id, name, slug")
    .single();

  if (error || !game) {
    throw error || new Error(`No se pudo crear el juego ${name}.`);
  }

  return game;
}

async function createApprovedProduct({ vendorId, categoryId, gameId, title, slug, priceCents }) {
  const { data: product, error } = await adminSupabase
    .from("products")
    .insert([
      {
        vendor_id: vendorId,
        category_id: categoryId,
        game_id: gameId,
        title,
        slug,
        short_description: `${title} QA bundle product.`,
        description: `${title} QA bundle product description.`,
        compatibility: "Rust",
        price_cents: priceCents,
        is_free: false,
        moderation_status: "approved",
      },
    ])
    .select("id, title, slug")
    .single();

  if (error || !product) {
    throw error || new Error(`No se pudo crear el producto ${title}.`);
  }

  const { error: mappingError } = await adminSupabase.from("product_categories").insert([
    {
      product_id: product.id,
      category_id: categoryId,
    },
  ]);

  if (mappingError) {
    throw mappingError;
  }

  return product;
}

async function createBundle({ vendorId, title, slug, productIds, priceCents }) {
  const { data: bundle, error } = await adminSupabase
    .from("bundles")
    .insert([
      {
        vendor_id: vendorId,
        title,
        slug,
        short_description: `${title} QA commercial bundle.`,
        description: `${title} QA commercial bundle description.`,
        price_cents: priceCents,
        is_active: true,
      },
    ])
    .select("id, slug")
    .single();

  if (error || !bundle) {
    throw error || new Error("No se pudo crear el bundle QA.");
  }

  const { error: bundleProductsError } = await adminSupabase.from("bundle_products").insert(
    productIds.map((productId, index) => ({
      bundle_id: bundle.id,
      product_id: productId,
      sort_order: index,
    }))
  );

  if (bundleProductsError) {
    throw bundleProductsError;
  }

  return bundle;
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

function collectCookies(response, jar) {
  const header = response.headers.get("set-cookie");
  if (!header) {
    return;
  }

  for (const chunk of header.split(/,(?=\s*sb-|[\w-]+=)/)) {
    const [pair] = chunk.split(";");
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    jar.set(key, value);
  }
}

function serializeCookies(jar) {
  return Array.from(jar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function main() {
  const results = [];
  let server = null;

  try {
    const seed = Date.now();
    const seller = await ensureUser({
      email: SELLER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Bundles Seller",
      username: `qa_bundles_seller_${seed}`,
    });
    await ensureUser({
      email: BUYER_EMAIL,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Bundles Buyer",
      username: `qa_bundles_buyer_${seed}`,
    });
    const vendor = await ensureVendor(seller.id, seed);
    const category = await createCategory({
      name: `QA Bundles Category ${seed}`,
      slug: `qa-bundles-category-${seed}`,
      sortOrder: 20,
    });
    const game = await createGame({
      name: `QA Bundles Game ${seed}`,
      slug: `qa-bundles-game-${seed}`,
      sortOrder: 20,
    });
    const productA = await createApprovedProduct({
      vendorId: vendor.id,
      categoryId: category.id,
      gameId: game.id,
      title: `QA Bundle Product A ${seed}`,
      slug: `qa-bundle-product-a-${seed}`,
      priceCents: 2400,
    });
    const productB = await createApprovedProduct({
      vendorId: vendor.id,
      categoryId: category.id,
      gameId: game.id,
      title: `QA Bundle Product B ${seed}`,
      slug: `qa-bundle-product-b-${seed}`,
      priceCents: 2100,
    });
    const bundle = await createBundle({
      vendorId: vendor.id,
      title: `QA Commercial Bundle ${seed}`,
      slug: `qa-commercial-bundle-${seed}`,
      productIds: [productA.id, productB.id],
      priceCents: 3300,
    });

    server = await startServer();

    const homeResponse = await request("/");
    const homeHtml = normalizeHtml(await homeResponse.text());
    recordCase(
      results,
      "header_publico_expone_enlace_a_bundles",
      "critical",
      homeResponse.status === 200 && homeHtml.includes('href="/bundles"'),
      `status=${homeResponse.status}`,
      "La navegacion publica debe exponer bundles como parte del spine comercial."
    );

    const bundlesResponse = await request("/bundles");
    const bundlesHtml = normalizeHtml(await bundlesResponse.text());
    recordCase(
      results,
      "bundles_tiene_listing_publico_de_primer_nivel",
      "critical",
      bundlesResponse.status === 200 &&
        bundlesHtml.includes('data-discovery-spine="marketplace"') &&
        bundlesHtml.includes('data-commerce-section="bundle-catalog"') &&
        bundlesHtml.includes(bundle.slug) &&
        bundlesHtml.includes(productA.title),
      `status=${bundlesResponse.status}`,
      "La ruta /bundles debe actuar como browse publico util para bundles."
    );

    const bundleDetailResponse = await request(`/bundles/${bundle.slug}`);
    const bundleDetailHtml = normalizeHtml(await bundleDetailResponse.text());
    recordCase(
      results,
      "detalle_de_bundle_explica_valor_e_incluye_continuidad",
      "critical",
      bundleDetailResponse.status === 200 &&
        bundleDetailHtml.includes('data-commerce-stage="bundle-detail-stage"') &&
        bundleDetailHtml.includes('href="/bundles"') &&
        bundleDetailHtml.includes(productA.title) &&
        bundleDetailHtml.includes(productB.title) &&
        bundleDetailHtml.includes("Continuidad postcompra"),
      `status=${bundleDetailResponse.status}`,
      "La ficha debe explicar valor del bundle y continuidad con productos y postcompra."
    );

    const cookieJar = new Map();
    const loginResponse = await request("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        identifier: BUYER_EMAIL,
        password: QA_PASSWORD,
      }),
    });
    collectCookies(loginResponse, cookieJar);

    const authCookie = serializeCookies(cookieJar);
    const authenticatedBundleResponse = await request(`/bundles/${bundle.slug}`, {
      headers: authCookie ? { cookie: authCookie } : {},
    });
    const authenticatedBundleHtml = normalizeHtml(await authenticatedBundleResponse.text());
    recordCase(
      results,
      "bundle_conduce_a_compra_real_para_buyer_autenticado",
      "critical",
      loginResponse.status === 200 &&
        authenticatedBundleResponse.status === 200 &&
        authenticatedBundleHtml.includes("Comprar bundle") &&
        !authenticatedBundleHtml.includes("Necesitas iniciar sesion"),
      `login=${loginResponse.status}, detail=${authenticatedBundleResponse.status}`,
      "El buyer autenticado debe ver continuidad directa a compra desde la ficha del bundle."
    );

    const checkoutResponse = await request(`/checkout/bundles/${bundle.id}`, {
      headers: authCookie ? { cookie: authCookie } : {},
    });
    const checkoutHtml = normalizeHtml(await checkoutResponse.text());
    recordCase(
      results,
      "checkout_de_bundle_mantiene_continuidad_desde_el_listing",
      "critical",
      checkoutResponse.status === 200 &&
        checkoutHtml.includes(bundle.title) &&
        checkoutHtml.includes(productA.title) &&
        checkoutHtml.includes("Comprar bundle"),
      `status=${checkoutResponse.status}`,
      "El bundle debe mantener continuidad real hasta checkout."
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      console.log(JSON.stringify({ results }, null, 2));
      throw new Error(
        `QA bundles commercial block con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
