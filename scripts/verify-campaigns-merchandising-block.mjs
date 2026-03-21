import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
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

function recordCase(results, name, severity, passed, observed, difference = null) {
  results.push({
    name,
    severity,
    status: passed ? "PASS" : "FAIL",
    observed,
    difference,
  });
}

const projectRoot = process.cwd();
loadEnvFile(resolve(projectRoot, ".env.local"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan variables de entorno de Supabase para la QA campaigns merchandising.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.CAMPAIGNS_MERCH_QA_PORT || 3238);
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
      const response = await fetch(`${BASE_URL}/deals`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("No se pudo iniciar el servidor local para la QA campaigns merchandising.");
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
      `No se pudo iniciar el servidor local para la QA campaigns merchandising. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
    );
  }

  return child;
}

async function ensureBundleFromApprovedProducts(seed) {
  const { data: products, error } = await adminSupabase
    .from("products")
    .select("id, vendor_id, title, slug, price_cents")
    .eq("moderation_status", "approved")
    .eq("is_free", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  const productRows = products || [];
  const product = productRows[0];
  if (!product) {
    throw new Error("La QA necesita al menos un producto aprobado para probar deals.");
  }

  const vendorProducts = productRows.filter((item) => item.vendor_id === product.vendor_id);
  const { data: existingBundles, error: bundleLookupError } = await adminSupabase
    .from("bundles")
    .select("id, vendor_id, title, slug, price_cents")
    .eq("vendor_id", product.vendor_id)
    .eq("is_active", true)
    .limit(1);

  if (bundleLookupError) throw bundleLookupError;

  let bundle = existingBundles?.[0] || null;

  if (!bundle) {
    if (vendorProducts.length < 2) {
      throw new Error("La QA necesita dos productos aprobados del mismo seller para sembrar un bundle.");
    }

    const { data: createdBundle, error: bundleError } = await adminSupabase
      .from("bundles")
      .insert([
        {
          vendor_id: product.vendor_id,
          title: `QA Deals Bundle ${seed}`,
          slug: `qa-deals-bundle-${seed}`,
          short_description: "Bundle QA para validar merchandising publico.",
          description: "Bundle QA para validar continuity comercial de campaigns.",
          price_cents:
            Math.max(
              100,
              vendorProducts.slice(0, 2).reduce((sum, item) => sum + item.price_cents, 0) - 200
            ),
          is_active: true,
        },
      ])
      .select("id, vendor_id, title, slug, price_cents")
      .single();

    if (bundleError || !createdBundle) {
      throw bundleError || new Error("No se pudo crear el bundle QA.");
    }

    bundle = createdBundle;

    const { error: bundleProductsError } = await adminSupabase.from("bundle_products").insert(
      vendorProducts.slice(0, 2).map((item, index) => ({
        bundle_id: bundle.id,
        product_id: item.id,
        sort_order: index,
      }))
    );

    if (bundleProductsError) throw bundleProductsError;
  }

  return { product, bundle };
}

async function seedCampaigns(seed) {
  const { product, bundle } = await ensureBundleFromApprovedProducts(seed);
  const startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await adminSupabase.from("campaigns").insert([
    {
      vendor_id: product.vendor_id,
      product_id: product.id,
      title: `QA Flash Deal ${seed}`,
      campaign_type: "flash_deal",
      discount_type: "percent",
      discount_value: 20,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: true,
    },
    {
      vendor_id: product.vendor_id,
      product_id: product.id,
      title: `QA Placement ${seed}`,
      campaign_type: "featured_placement",
      discount_type: null,
      discount_value: null,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: true,
    },
    {
      vendor_id: bundle.vendor_id,
      bundle_id: bundle.id,
      title: `QA Launch Bundle ${seed}`,
      campaign_type: "launch_discount",
      discount_type: "fixed",
      discount_value: 300,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: true,
    },
  ]);

  if (error) throw error;
  return { product, bundle };
}

async function main() {
  const results = [];
  let server = null;

  try {
    const seed = Date.now();
    const { product, bundle } = await seedCampaigns(seed);
    server = await startServer();

    const homeResponse = await request("/");
    const homeHtml = normalizeHtml(await homeResponse.text());
    recordCase(
      results,
      "header_publico_expone_deals",
      "critical",
      homeResponse.status === 200 && homeHtml.includes('href="/deals"'),
      `status=${homeResponse.status}`,
      "La navegacion publica debe exponer la nueva superficie de merchandising."
    );

    const dealsResponse = await request("/deals");
    const dealsHtml = normalizeHtml(await dealsResponse.text());
    recordCase(
      results,
      "deals_tiene_landing_publica_de_merchandising",
      "critical",
      dealsResponse.status === 200 &&
        dealsHtml.includes('data-commerce-stage="deals-stage"') &&
        dealsHtml.includes('data-merchandising-surface="placements"') &&
        dealsHtml.includes('data-merchandising-surface="product-deals"') &&
        dealsHtml.includes('data-merchandising-surface="bundle-deals"'),
      `status=${dealsResponse.status}`,
      "La ruta /deals debe actuar como landing publica de campaigns y merchandising."
    );

    recordCase(
      results,
      "deals_conecta_con_producto_en_campana",
      "critical",
      dealsHtml.includes(product.title) && dealsHtml.includes(`href="/products/${product.slug}"`),
      product.slug,
      "La landing de deals debe conducir claramente al producto promocionado."
    );

    recordCase(
      results,
      "deals_conecta_con_bundle_en_campana",
      "critical",
      dealsHtml.includes(bundle.title) && dealsHtml.includes(`href="/bundles/${bundle.slug}"`),
      bundle.slug,
      "La landing de deals debe conducir claramente al bundle promocionado."
    );

    recordCase(
      results,
      "deals_hace_visible_el_valor_promocional",
      "critical",
      dealsHtml.includes("QA Flash Deal") &&
        dealsHtml.includes("QA Launch Bundle") &&
        (dealsHtml.includes("OFF") || dealsHtml.includes("Ahorro EUR")),
      "promo_value_visible",
      "La superficie debe explicar el valor promocional y no quedarse en un widget decorativo."
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      console.log(JSON.stringify({ results }, null, 2));
      throw new Error(
        `QA campaigns merchandising con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
