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
  throw new Error("Faltan variables de entorno de Supabase para la QA marketplace quality signals.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.MARKETPLACE_QUALITY_SIGNALS_QA_PORT || 3232);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const QA_PASSWORD = "ForjaDevQA!2026";
const SELLER_EMAIL = "qa-quality-signals-seller@forjadev.local";

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
  throw new Error("No se pudo iniciar el servidor local para la QA marketplace quality signals.");
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
      `No se pudo iniciar el servidor local para la QA marketplace quality signals. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA Quality Signals Seller",
        slug: `qa-quality-signals-seller-${Date.now()}`,
        bio: "QA seller for quality signals verification.",
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
        description: `${name} QA quality signals.`,
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

async function createApprovedProduct({
  vendorId,
  categoryId,
  gameId,
  title,
  slug,
}) {
  const { data: product, error } = await adminSupabase
    .from("products")
    .insert([
      {
        vendor_id: vendorId,
        category_id: categoryId,
        game_id: gameId,
        title,
        slug,
        short_description: `${title} QA trust snapshot.`,
        description: `${title} QA trust snapshot.`,
        compatibility: "Rust",
        price_cents: 2100,
        is_free: false,
        moderation_status: "approved",
        rating_average: 4.8,
        rating_count: 12,
        purchase_count: 48,
        support_policy: "Respuesta de soporte dentro del workspace del producto.",
        refund_policy: "Si el caso procede, el marketplace puede emitir refund tras revision.",
        update_policy: "Actualizaciones activas mientras el producto siga vivo.",
        updated_at: new Date().toISOString(),
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

  const { error: versionError } = await adminSupabase.from("product_versions").insert([
    {
      product_id: product.id,
      version: "2.4.0",
      changelog: "QA active release for trust snapshot.",
      release_status: "active",
      activated_at: new Date().toISOString(),
    },
  ]);

  if (versionError) {
    throw versionError;
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
      displayName: "QA Quality Signals Seller",
      username: `qa_quality_signals_seller_${seed}`,
    });
    const vendor = await ensureVendor(seller.id);
    const rootCategory = await createCategory({
      name: `QA Trust Systems ${seed}`,
      slug: `qa-trust-systems-${seed}`,
      sortOrder: 10,
    });
    const childCategory = await createCategory({
      name: `QA Trust Tooling ${seed}`,
      slug: `qa-trust-tooling-${seed}`,
      parentId: rootCategory.id,
      sortOrder: 11,
    });
    const game = await createGame({
      name: `QA Trust Rust ${seed}`,
      slug: `qa-trust-rust-${seed}`,
      sortOrder: 10,
    });
    const product = await createApprovedProduct({
      vendorId: vendor.id,
      categoryId: childCategory.id,
      gameId: game.id,
      title: `QA Trust Snapshot Product ${seed}`,
      slug: `qa-trust-snapshot-product-${seed}`,
    });

    const { error: identityError } = await adminSupabase.from("user_provider_identities").insert([
      {
        user_id: seller.id,
        provider: "discord",
        provider_user_id: `qa-trust-discord-${seed}`,
        provider_email: SELLER_EMAIL,
        provider_username: `qa_trust_discord_${seed}`,
      },
    ]);

    if (identityError && !`${identityError.message || ""}`.toLowerCase().includes("duplicate")) {
      throw identityError;
    }

    const { error: snapshotError } = await adminSupabase
      .from("seller_reputation_snapshots")
      .upsert([
        {
          vendor_id: vendor.id,
          approved_products: 6,
          free_products: 1,
          paid_products: 5,
          total_downloads: 120,
          total_purchases: 48,
          total_ratings: 12,
          average_rating: 4.8,
          joined_at: new Date().toISOString(),
          latest_product_update_at: new Date().toISOString(),
          reputation_score: 86,
        },
      ]);

    if (snapshotError) {
      throw snapshotError;
    }

    server = await startServer();

    const productsResponse = await request(
      `/products?game=${game.slug}&category=${childCategory.slug}&sort=updated`
    );
    const productsHtml = normalizeHtml(await productsResponse.text());
    recordCase(
      results,
      "catalogo_muestra_snapshot_compacto_de_confianza",
      "critical",
      productsResponse.status === 200 &&
        productsHtml.includes('data-shopping-quality="compact"') &&
        productsHtml.includes('data-quality-signal="Muy bien valorado"') &&
        productsHtml.includes('data-quality-signal="Identidad verificada"') &&
        productsHtml.includes('data-quality-signal="Mantenimiento reciente"'),
      `status=${productsResponse.status}`,
      "El catalogo debe mostrar una lectura compacta y util de confianza precompra"
    );

    const categoryResponse = await request(`/categories/${rootCategory.slug}`);
    const categoryHtml = normalizeHtml(await categoryResponse.text());
    recordCase(
      results,
      "categoria_reutiliza_snapshot_comparto",
      "critical",
      categoryResponse.status === 200 &&
        categoryHtml.includes('data-shopping-quality="compact"') &&
        categoryHtml.includes('data-quality-signal="Soporte y reembolsos claros"'),
      `status=${categoryResponse.status}`,
      "La categoria debe mantener continuidad de las senales de compra con contexto"
    );

    const gameResponse = await request(`/games/${game.slug}`);
    const gameHtml = normalizeHtml(await gameResponse.text());
    recordCase(
      results,
      "juego_reutiliza_snapshot_comparto",
      "critical",
      gameResponse.status === 200 &&
        gameHtml.includes('data-shopping-quality="compact"') &&
        gameHtml.includes('data-quality-signal="Identidad verificada"'),
      `status=${gameResponse.status}`,
      "La vista por juego debe mantener continuidad de las senales de confianza"
    );

    const productResponse = await request(`/products/${product.slug}`);
    const productHtml = normalizeHtml(await productResponse.text());
    recordCase(
      results,
      "ficha_muestra_snapshot_detallado_de_compra_con_contexto",
      "critical",
      productResponse.status === 200 &&
        productHtml.includes('data-shopping-quality="detail"') &&
        productHtml.includes('data-quality-signal="Muy bien valorado"') &&
        productHtml.includes('data-quality-signal="Soporte y reembolsos claros"') &&
        productHtml.includes("Estas senales ayudan a reducir incertidumbre antes de comprar."),
      `status=${productResponse.status}`,
      "La ficha debe explicar mejor la confianza y calidad sin obligar al usuario a reconstruirla"
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      throw new Error(
        `QA marketplace quality signals con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
