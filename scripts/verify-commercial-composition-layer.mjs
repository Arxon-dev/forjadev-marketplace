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
  throw new Error("Faltan variables de entorno de Supabase para la QA commercial composition layer.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.COMMERCIAL_COMPOSITION_QA_PORT || 3247);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SELLER_EMAIL = "qa-commercial-composition-seller@forjadev.local";
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
      const response = await fetch(`${BASE_URL}/products`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("No se pudo iniciar el servidor local para la QA commercial composition layer.");
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
      `No se pudo iniciar el servidor local para la QA commercial composition layer. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA Commercial Composition Seller",
        slug: `qa-commercial-composition-${seed}`,
        bio: "QA seller for commercial composition.",
      },
    ])
    .select("id")
    .single();

  if (error || !vendor) {
    throw error || new Error("No se pudo crear el vendor QA.");
  }

  return vendor;
}

async function createApprovedProduct({ vendorId, title, slug, priceCents }) {
  const { data: product, error } = await adminSupabase
    .from("products")
    .insert([
      {
        vendor_id: vendorId,
        title,
        slug,
        short_description: `${title} QA commercial composition.`,
        description: `${title} QA commercial composition.`,
        price_cents: priceCents,
        is_free: false,
        moderation_status: "approved",
      },
    ])
    .select("id, title, slug, price_cents")
    .single();

  if (error || !product) {
    throw error || new Error("No se pudo crear el producto QA.");
  }

  return product;
}

async function createBundle({ vendorId, title, slug, priceCents }) {
  const { data: bundle, error } = await adminSupabase
    .from("bundles")
    .insert([
      {
        vendor_id: vendorId,
        title,
        slug,
        short_description: `${title} QA compuesto.`,
        description: `${title} QA compuesto.`,
        price_cents: priceCents,
        is_active: true,
      },
    ])
    .select("id, slug")
    .single();

  if (error || !bundle) {
    throw error || new Error("No se pudo crear el bundle QA.");
  }

  return bundle;
}

async function attachProductsToBundle(bundleId, products) {
  const { error } = await adminSupabase.from("bundle_products").insert(
    products.map((product, index) => ({
      bundle_id: bundleId,
      product_id: product.id,
      sort_order: index + 1,
    }))
  );

  if (error) {
    throw error;
  }
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
    const seller = await ensureUser({
      email: SELLER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Commercial Composition Seller",
      username: `qa_commercial_composition_${seed}`,
    });
    const vendor = await ensureVendor(seller.id, seed);

    const anchorProduct = await createApprovedProduct({
      vendorId: vendor.id,
      title: `QA Anchor Product ${seed}`,
      slug: `qa-anchor-product-${seed}`,
      priceCents: 2200,
    });
    const companionProduct = await createApprovedProduct({
      vendorId: vendor.id,
      title: `QA Companion Product ${seed}`,
      slug: `qa-companion-product-${seed}`,
      priceCents: 1800,
    });
    const standaloneProduct = await createApprovedProduct({
      vendorId: vendor.id,
      title: `QA Standalone Product ${seed}`,
      slug: `qa-standalone-product-${seed}`,
      priceCents: 2600,
    });

    const bundle = await createBundle({
      vendorId: vendor.id,
      title: `QA Bundle Composition ${seed}`,
      slug: `qa-bundle-composition-${seed}`,
      priceCents: 3000,
    });
    await attachProductsToBundle(bundle.id, [anchorProduct, companionProduct]);

    server = await startServer();

    const anchorResponse = await request(`/products/${anchorProduct.slug}`);
    const anchorHtml = normalizeHtml(await anchorResponse.text());
    recordCase(
      results,
      "ficha_producto_expone_compra_compuesta_con_bundle",
      "critical",
      anchorResponse.status === 200 &&
        anchorHtml.includes('data-commercial-composition="product-bundles"') &&
        anchorHtml.includes("Este producto tambien se vende mejor como parte de un bundle") &&
        anchorHtml.includes(bundle.slug) &&
        anchorHtml.includes(anchorProduct.title) &&
        anchorHtml.includes(companionProduct.title),
      `status=${anchorResponse.status}`,
      "La ficha del producto debe exponer la ruta compuesta hacia bundles relevantes."
    );

    recordCase(
      results,
      "ficha_producto_explica_valor_combinado_y_ahorro",
      "critical",
      anchorHtml.includes("Compra individual actual:") &&
        anchorHtml.includes("Valor combinado claro") &&
        anchorHtml.includes("Ahorro EUR") &&
        anchorHtml.includes("Ver bundle"),
      "composition_value_signals",
      "La composicion comercial debe explicar mejor el valor combinado antes de salir a checkout."
    );

    const standaloneResponse = await request(`/products/${standaloneProduct.slug}`);
    const standaloneHtml = normalizeHtml(await standaloneResponse.text());
    recordCase(
      results,
      "producto_sin_bundle_no_muestra_ruido_compuesto",
      "high",
      standaloneResponse.status === 200 &&
        !standaloneHtml.includes('data-commercial-composition="product-bundles"'),
      `status=${standaloneResponse.status}`,
      "La capa no debe introducir ruido cuando no exista una composicion comercial real."
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      throw new Error(
        `QA commercial composition layer con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
