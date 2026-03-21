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
  throw new Error("Faltan variables de entorno de Supabase para la QA visual premium publica.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.VISUAL_PREMIUM_PUBLIC_QA_PORT || 3252);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SELLER_EMAIL = "qa-visual-premium-seller@forjadev.local";
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
  throw new Error("No se pudo iniciar el servidor local para la QA visual premium publica.");
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
      `No se pudo iniciar el servidor local para la QA visual premium publica. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA Visual Premium Seller",
        slug: `qa-visual-premium-seller-${seed}`,
        bio: "QA seller for public premium visual verification.",
      },
    ])
    .select("id")
    .single();

  if (error || !vendor) {
    throw error || new Error("No se pudo crear el vendor QA visual premium.");
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
        description: `${name} QA visual premium.`,
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
        short_description: `${title} QA visual premium.`,
        description: `${title} QA visual premium.`,
        compatibility: "Rust",
        price_cents: priceCents,
        is_free: false,
        moderation_status: "approved",
        rating_average: 4.8,
        rating_count: 12,
        support_policy: "Soporte visible.",
        refund_policy: "Refund visible.",
        update_policy: "Updates visibles.",
        featured: true,
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
        short_description: `${title} QA visual premium.`,
        description: `${title} QA visual premium.`,
        price_cents: priceCents,
        is_active: true,
      },
    ])
    .select("id, slug, title")
    .single();

  if (error || !bundle) {
    throw error || new Error("No se pudo crear el bundle QA visual premium.");
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

async function seedCampaigns({ vendorId, productId, bundleId, seed }) {
  const startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await adminSupabase.from("campaigns").insert([
    {
      vendor_id: vendorId,
      product_id: productId,
      title: `QA Premium Deal ${seed}`,
      campaign_type: "flash_deal",
      discount_type: "percent",
      discount_value: 20,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: true,
    },
    {
      vendor_id: vendorId,
      bundle_id: bundleId,
      title: `QA Premium Bundle Deal ${seed}`,
      campaign_type: "launch_discount",
      discount_type: "fixed",
      discount_value: 300,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: true,
    },
  ]);

  if (error) {
    throw error;
  }
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
      displayName: "QA Visual Premium Seller",
      username: `qa_visual_premium_${seed}`,
    });
    const vendor = await ensureVendor(seller.id, seed);
    const category = await createCategory({
      name: `QA Visual Premium Category ${seed}`,
      slug: `qa-visual-premium-category-${seed}`,
      sortOrder: 15,
    });
    const game = await createGame({
      name: `QA Visual Premium Game ${seed}`,
      slug: `qa-visual-premium-game-${seed}`,
      sortOrder: 15,
    });
    const productA = await createApprovedProduct({
      vendorId: vendor.id,
      categoryId: category.id,
      gameId: game.id,
      title: `QA Visual Premium Product A ${seed}`,
      slug: `qa-visual-premium-product-a-${seed}`,
      priceCents: 2600,
    });
    const productB = await createApprovedProduct({
      vendorId: vendor.id,
      categoryId: category.id,
      gameId: game.id,
      title: `QA Visual Premium Product B ${seed}`,
      slug: `qa-visual-premium-product-b-${seed}`,
      priceCents: 1900,
    });
    const bundle = await createBundle({
      vendorId: vendor.id,
      title: `QA Visual Premium Bundle ${seed}`,
      slug: `qa-visual-premium-bundle-${seed}`,
      productIds: [productA.id, productB.id],
      priceCents: 3600,
    });
    await seedCampaigns({
      vendorId: vendor.id,
      productId: productA.id,
      bundleId: bundle.id,
      seed,
    });

    server = await startServer();

    const homeHtml = normalizeHtml(await (await request("/")).text());
    recordCase(
      results,
      "home_abre_con_stage_y_sections_premium_coherentes",
      "critical",
      homeHtml.includes('data-commerce-stage="home-hero"') &&
        homeHtml.includes('data-commerce-section="home-categories"'),
      "home_shell",
      "Home debe abrir la capa publica con stage y section language premium compartido."
    );

    const catalogHtml = normalizeHtml(await (await request("/products")).text());
    recordCase(
      results,
      "catalogo_refuerza_cards_y_cta_language",
      "critical",
      catalogHtml.includes('data-premium-card="product"') &&
        catalogHtml.includes("Compara antes de comprar") &&
        catalogHtml.includes("Abrir ficha completa"),
      "catalog_cards",
      "Catalogo debe heredar cards y CTA language premium de forma consistente."
    );

    const categoryHtml = normalizeHtml(await (await request(`/categories/${category.slug}`)).text());
    recordCase(
      results,
      "taxonomia_hereda_stage_y_tiles_del_sistema",
      "critical",
      categoryHtml.includes('data-commerce-stage="category-stage"') &&
        categoryHtml.includes('data-commerce-section="category-products"'),
      "category_stage",
      "La taxonomia debe sentirse parte del mismo sistema premium que el browse general."
    );

    const gameHtml = normalizeHtml(await (await request(`/games/${game.slug}`)).text());
    recordCase(
      results,
      "juegos_heredan_gramatica_visual_compartida",
      "critical",
      gameHtml.includes('data-commerce-stage="game-stage"') &&
        gameHtml.includes('data-commerce-section="game-products"') &&
        gameHtml.includes('data-premium-card="product"'),
      "game_stage",
      "La superficie por juego debe mantener continuidad visual con catalogo y categoria."
    );

    const productHtml = normalizeHtml(await (await request(`/products/${productA.slug}`)).text());
    recordCase(
      results,
      "ficha_conecta_stage_trust_y_composicion_visual",
      "critical",
      productHtml.includes('data-commerce-stage="product-stage"') &&
        productHtml.includes('data-commercial-composition="product-bundles"') &&
        productHtml.includes('data-commerce-section="product-description"'),
      "product_detail",
      "La ficha debe integrar el nuevo framing premium con trust y composicion comercial."
    );

    const bundlesHtml = normalizeHtml(await (await request("/bundles")).text());
    recordCase(
      results,
      "bundles_heredan_cards_y_heading_premium",
      "critical",
      bundlesHtml.includes('data-commerce-section="bundle-catalog"') &&
        bundlesHtml.includes('data-premium-card="bundle"') &&
        bundlesHtml.includes(bundle.slug),
      "bundles_listing",
      "Bundles debe sentirse dentro del mismo marketplace premium, no como bloque visual aparte."
    );

    const dealsHtml = normalizeHtml(await (await request("/deals")).text());
    recordCase(
      results,
      "deals_heredan_stage_merchandising_y_cards_coherentes",
      "critical",
      dealsHtml.includes('data-commerce-stage="deals-stage"') &&
        dealsHtml.includes('data-merchandising-surface="placements"') &&
        dealsHtml.includes('data-premium-card="product"') &&
        dealsHtml.includes('data-premium-card="bundle"'),
      "deals_surface",
      "Deals debe integrarse visualmente con el resto de surfaces comerciales."
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      throw new Error(
        `QA visual premium publica con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
