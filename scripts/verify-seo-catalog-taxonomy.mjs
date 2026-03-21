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

function extractTitle(html) {
  const match = html.match(/<title>(.*?)<\/title>/i);
  return match ? match[1] : "";
}

const projectRoot = process.cwd();
loadEnvFile(resolve(projectRoot, ".env.local"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan variables de entorno de Supabase para la QA SEO catalog taxonomy.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.SEO_CATALOG_TAXONOMY_QA_PORT || 3230);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const QA_PASSWORD = "ForjaDevQA!2026";
const SELLER_EMAIL = "qa-seo-seller@forjadev.local";

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
  throw new Error("No se pudo iniciar el servidor local para la QA SEO catalog taxonomy.");
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
      `No se pudo iniciar el servidor local para la QA SEO catalog taxonomy. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA SEO Seller",
        slug: `qa-seo-seller-${Date.now()}`,
        bio: "QA seller for SEO taxonomy verification.",
      },
    ])
    .select("id")
    .single();

  if (error || !vendor) {
    throw error || new Error("No se pudo crear el vendor QA.");
  }

  return vendor;
}

async function createCategory({ name, slug, parentId = null, sortOrder = 100 }) {
  const { data: category, error } = await adminSupabase
    .from("categories")
    .insert([
      {
        name,
        slug,
        description: `${name} QA SEO.`,
        parent_id: parentId,
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

async function createApprovedProduct({ vendorId, categoryId, gameId, title, slug }) {
  const { data: product, error } = await adminSupabase
    .from("products")
    .insert([
      {
        vendor_id: vendorId,
        category_id: categoryId,
        game_id: gameId,
        title,
        slug,
        short_description: `${title} QA SEO taxonomy.`,
        description: `${title} QA SEO taxonomy.`,
        compatibility: "Rust",
        price_cents: 1700,
        is_free: false,
        moderation_status: "approved",
      },
    ])
    .select("id, title, slug")
    .single();

  if (error || !product) {
    throw error || new Error("No se pudo crear el producto QA.");
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
      displayName: "QA SEO Seller",
      username: `qa_seo_seller_${seed}`,
    });
    const vendor = await ensureVendor(seller.id);
    const rootCategory = await createCategory({
      name: `QA SEO Systems ${seed}`,
      slug: `qa-seo-systems-${seed}`,
      sortOrder: 10,
    });
    const childCategory = await createCategory({
      name: `QA SEO Tooling ${seed}`,
      slug: `qa-seo-tooling-${seed}`,
      parentId: rootCategory.id,
      sortOrder: 11,
    });
    const game = await createGame({
      name: `QA SEO Rust ${seed}`,
      slug: `qa-seo-rust-${seed}`,
      sortOrder: 10,
    });
    const product = await createApprovedProduct({
      vendorId: vendor.id,
      categoryId: childCategory.id,
      gameId: game.id,
      title: `QA SEO Spine Product ${seed}`,
      slug: `qa-seo-spine-product-${seed}`,
    });

    server = await startServer();

    const homeResponse = await request("/");
    const homeHtml = normalizeHtml(await homeResponse.text());
    recordCase(
      results,
      "home_tiene_metadata_util",
      "critical",
      homeResponse.status === 200 &&
        extractTitle(homeHtml).includes("Marketplace premium para plugins, mapas y herramientas") &&
        homeHtml.includes('rel="canonical" href="http://localhost:3000"'),
      `status=${homeResponse.status}`,
      "La home debe tener un title util y canonical propia"
    );

    const productsResponse = await request("/products");
    const productsHtml = normalizeHtml(await productsResponse.text());
    recordCase(
      results,
      "catalogo_base_es_indexable_y_canonico",
      "critical",
      productsResponse.status === 200 &&
        extractTitle(productsHtml).includes("Catalogo de productos") &&
        productsHtml.includes('rel="canonical" href="http://localhost:3000/products"') &&
        productsHtml.includes('content="index, follow"'),
      `status=${productsResponse.status}`,
      "La ruta /products debe ser indexable y canonical"
    );

    const filteredProductsResponse = await request(`/products?game=${game.slug}&category=${childCategory.slug}&sort=updated`);
    const filteredProductsHtml = normalizeHtml(await filteredProductsResponse.text());
    recordCase(
      results,
      "catalogo_filtrado_queda_noindex_con_canonical_al_catalogo",
      "critical",
      filteredProductsResponse.status === 200 &&
        filteredProductsHtml.includes('rel="canonical" href="http://localhost:3000/products"') &&
        filteredProductsHtml.includes('content="noindex, follow, nocache"'),
      `status=${filteredProductsResponse.status}`,
      "Los estados faceteados del catalogo no deben competir como landings indexables"
    );

    const categoriesIndexResponse = await request("/categories");
    const categoriesIndexHtml = normalizeHtml(await categoriesIndexResponse.text());
    recordCase(
      results,
      "indice_de_categorias_tiene_metadata_propia",
      "critical",
      categoriesIndexResponse.status === 200 &&
        extractTitle(categoriesIndexHtml).includes("Categorias del marketplace") &&
        categoriesIndexHtml.includes('rel="canonical" href="http://localhost:3000/categories"'),
      `status=${categoriesIndexResponse.status}`,
      "La ruta /categories debe tener metadata propia e indexable"
    );

    const categoryResponse = await request(`/categories/${childCategory.slug}`);
    const categoryHtml = normalizeHtml(await categoryResponse.text());
    recordCase(
      results,
      "detalle_de_categoria_tiene_title_y_canonical_unicos",
      "critical",
      categoryResponse.status === 200 &&
        extractTitle(categoryHtml).includes(`${childCategory.name} en el marketplace`) &&
        categoryHtml.includes(
          `rel="canonical" href="http://localhost:3000/categories/${childCategory.slug}"`
        ),
      `status=${categoryResponse.status}`,
      "La categoria debe funcionar como landing indexable propia"
    );

    const gamesIndexResponse = await request("/games");
    const gamesIndexHtml = normalizeHtml(await gamesIndexResponse.text());
    recordCase(
      results,
      "indice_de_juegos_tiene_metadata_propia",
      "critical",
      gamesIndexResponse.status === 200 &&
        extractTitle(gamesIndexHtml).includes("Juegos compatibles del marketplace") &&
        gamesIndexHtml.includes('rel="canonical" href="http://localhost:3000/games"'),
      `status=${gamesIndexResponse.status}`,
      "La ruta /games debe tener metadata propia e indexable"
    );

    const gameResponse = await request(`/games/${game.slug}`);
    const gameHtml = normalizeHtml(await gameResponse.text());
    recordCase(
      results,
      "detalle_de_juego_tiene_title_y_canonical_unicos",
      "critical",
      gameResponse.status === 200 &&
        extractTitle(gameHtml).includes(`Recursos de ${game.name}`) &&
        gameHtml.includes(`rel="canonical" href="http://localhost:3000/games/${game.slug}"`),
      `status=${gameResponse.status}`,
      "La ruta /games/[slug] debe servir como landing indexable del ecosistema"
    );

    const productResponse = await request(`/products/${product.slug}`);
    const productHtml = normalizeHtml(await productResponse.text());
    recordCase(
      results,
      "ficha_de_producto_tiene_metadata_unica_y_og",
      "critical",
      productResponse.status === 200 &&
        extractTitle(productHtml).includes(product.title) &&
        productHtml.includes(`rel="canonical" href="http://localhost:3000/products/${product.slug}"`) &&
        productHtml.includes(`property="og:title" content="${product.title}"`) &&
        productHtml.includes('content="index, follow"'),
      `status=${productResponse.status}`,
      "La ficha publica debe tener metadata unica, canonical y OG listos para indexacion"
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      throw new Error(
        `QA SEO catalog taxonomy con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
