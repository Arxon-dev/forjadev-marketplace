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
  throw new Error("Faltan variables de entorno de Supabase para la QA frontend premium.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.FRONTEND_PREMIUM_QA_PORT || 3234);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const QA_PASSWORD = "ForjaDevQA!2026";
const SELLER_EMAIL = "qa-frontend-premium-seller@forjadev.local";

async function request(pathname) {
  return fetch(`${BASE_URL}${pathname}`, { redirect: "manual" });
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
  throw new Error("No se pudo iniciar el servidor local para la QA frontend premium.");
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
      `No se pudo iniciar el servidor local para la QA frontend premium. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA Frontend Premium Seller",
        slug: `qa-frontend-premium-seller-${Date.now()}`,
        bio: "QA seller for public shopping-journey frontend verification.",
      },
    ])
    .select("id")
    .single();

  if (error || !vendor) {
    throw error || new Error("No se pudo crear el vendor QA.");
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
        description: `${name} QA premium browse.`,
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
        short_description: `${title} QA premium journey.`,
        description: `${title} QA premium journey.`,
        compatibility: "Rust",
        price_cents: 2600,
        is_free: false,
        moderation_status: "approved",
        rating_average: 4.7,
        rating_count: 9,
        support_policy: "Soporte visible.",
        refund_policy: "Refund visible.",
        update_policy: "Updates visibles.",
        featured: true,
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
      displayName: "QA Frontend Premium Seller",
      username: `qa_frontend_premium_seller_${seed}`,
    });
    const vendor = await ensureVendor(seller.id);
    const category = await createCategory({
      name: `QA Premium Category ${seed}`,
      slug: `qa-premium-category-${seed}`,
      sortOrder: 10,
    });
    const game = await createGame({
      name: `QA Premium Game ${seed}`,
      slug: `qa-premium-game-${seed}`,
      sortOrder: 10,
    });
    const product = await createApprovedProduct({
      vendorId: vendor.id,
      categoryId: category.id,
      gameId: game.id,
      title: `QA Premium Product ${seed}`,
      slug: `qa-premium-product-${seed}`,
    });

    server = await startServer();

    const homeHtml = normalizeHtml(await (await request("/")).text());
    recordCase(
      results,
      "home_expone_stage_premium_del_shopping_journey",
      "critical",
      homeHtml.includes('data-commerce-stage="home-hero"') &&
        homeHtml.includes('data-commerce-section="home-categories"'),
      "status=200",
      "Home debe abrir el journey publico con una cabecera premium y secciones consistentes."
    );

    const catalogHtml = normalizeHtml(await (await request("/products")).text());
    recordCase(
      results,
      "catalogo_muestra_consistencia_de_section_y_cards",
      "critical",
      catalogHtml.includes('data-commerce-section="catalog-grid"') &&
        catalogHtml.includes('data-premium-card="product"'),
      "status=200",
      "Catalogo debe reforzar legibilidad y continuidad con cards premium."
    );

    const categoryHtml = normalizeHtml(await (await request(`/categories/${category.slug}`)).text());
    recordCase(
      results,
      "categoria_hereda_stage_premium_de_browse",
      "critical",
      categoryHtml.includes('data-commerce-stage="category-stage"') &&
        categoryHtml.includes('data-commerce-section="category-products"'),
      "status=200",
      "La categoria debe sentirse parte del mismo sistema premium de browse."
    );

    const gameHtml = normalizeHtml(await (await request(`/games/${game.slug}`)).text());
    recordCase(
      results,
      "juego_hereda_stage_premium_de_browse",
      "critical",
      gameHtml.includes('data-commerce-stage="game-stage"') &&
        gameHtml.includes('data-commerce-section="game-products"'),
      "status=200",
      "La vista por juego debe mantener continuidad visual con el resto del journey."
    );

    const productHtml = normalizeHtml(await (await request(`/products/${product.slug}`)).text());
    recordCase(
      results,
      "ficha_arranca_con_stage_premium_y_card_consistente",
      "critical",
      productHtml.includes('data-commerce-stage="product-stage"') &&
        productHtml.includes('data-commerce-section="product-description"'),
      "status=200",
      "La ficha debe conectar visualmente con discovery sin perder jerarquia comercial."
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      throw new Error(
        `QA frontend premium con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
