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
  throw new Error("Faltan variables de entorno de Supabase para la QA editorial help-commerce.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.EDITORIAL_HELP_COMMERCE_QA_PORT || 3233);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const QA_PASSWORD = "ForjaDevQA!2026";
const SELLER_EMAIL = "qa-editorial-commerce-seller@forjadev.local";

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
  throw new Error("No se pudo iniciar el servidor local para la QA editorial help-commerce.");
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
      `No se pudo iniciar el servidor local para la QA editorial help-commerce. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA Editorial Commerce Seller",
        slug: `qa-editorial-commerce-seller-${Date.now()}`,
        bio: "QA seller for editorial help-commerce verification.",
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
        description: `${name} QA editorial commerce.`,
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
        short_description: `${title} QA commerce help.`,
        description: `${title} QA commerce help.`,
        compatibility: "Rust",
        price_cents: 1900,
        is_free: false,
        moderation_status: "approved",
        support_policy: "Respuesta de soporte visible antes de comprar.",
        refund_policy: "Los reembolsos siguen una revision formal del marketplace.",
        update_policy: "Mantenimiento activo mientras el producto siga vivo.",
      },
    ])
    .select("id, title, slug")
    .single();

  if (error || !product) {
    throw error || new Error("No se pudo crear el producto QA.");
  }

  const { error: versionError } = await adminSupabase.from("product_versions").insert([
    {
      product_id: product.id,
      version: "1.0.0",
      changelog: "QA editorial commerce release.",
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
      displayName: "QA Editorial Commerce Seller",
      username: `qa_editorial_commerce_seller_${seed}`,
    });
    const vendor = await ensureVendor(seller.id);
    const category = await createCategory({
      name: `QA Commerce Navigation ${seed}`,
      slug: `qa-commerce-navigation-${seed}`,
      sortOrder: 10,
    });
    const game = await createGame({
      name: `QA Commerce Game ${seed}`,
      slug: `qa-commerce-game-${seed}`,
      sortOrder: 10,
    });
    const product = await createApprovedProduct({
      vendorId: vendor.id,
      categoryId: category.id,
      gameId: game.id,
      title: `QA Commerce Guidance Product ${seed}`,
      slug: `qa-commerce-guidance-product-${seed}`,
    });

    const { data: helpCategory, error: helpCategoryError } = await adminSupabase
      .from("help_center_categories")
      .insert([
        {
          slug: `qa-commerce-help-${seed}`,
          title: `QA Commerce Help ${seed}`,
          description: "Categoria editorial para integrar ayuda con decision de compra.",
          icon: "guide",
          sort_order: 10,
          status: "published",
          is_public: true,
        },
      ])
      .select("id, slug, title")
      .single();

    if (helpCategoryError || !helpCategory) {
      throw helpCategoryError || new Error("No se pudo crear la categoria help QA.");
    }

    const { data: article, error: articleError } = await adminSupabase
      .from("help_center_articles")
      .insert([
        {
          category_id: helpCategory.id,
          related_product_id: product.id,
          article_type: "guide",
          audience: "buyer",
          slug: `qa-commerce-buying-guide-${seed}`,
          title: `QA Buying Guide ${seed}`,
          summary: "Resuelve dudas comunes sobre soporte, acceso y compra antes de decidir.",
          body: "Contenido QA para integrar ayuda publica con el momento de compra.",
          status: "published",
          is_featured: true,
          sort_order: 10,
          created_by_user_id: seller.id,
          published_at: new Date().toISOString(),
        },
      ])
      .select("id, slug, title")
      .single();

    if (articleError || !article) {
      throw articleError || new Error("No se pudo crear el articulo help QA.");
    }

    const { data: policy, error: policyError } = await adminSupabase
      .from("marketplace_policy_pages")
      .insert([
        {
          policy_key: `qa-commerce-policy-${seed}`,
          title: `QA Commerce Policy ${seed}`,
          summary: "Policy publica para orientar la compra y la continuidad postventa.",
          body: "Contenido QA para policy publica orientada a buyer/shared.",
          audience: "shared",
          status: "published",
          sort_order: 10,
          created_by_user_id: seller.id,
          published_at: new Date().toISOString(),
        },
      ])
      .select("id, policy_key, title")
      .single();

    if (policyError || !policy) {
      throw policyError || new Error("No se pudo crear la policy QA.");
    }

    server = await startServer();

    const productResponse = await request(`/products/${product.slug}`);
    const productHtml = normalizeHtml(await productResponse.text());
    recordCase(
      results,
      "ficha_muestra_modulo_editorial_comercial",
      "critical",
      productResponse.status === 200 &&
        productHtml.includes('data-commerce-help="product"') &&
        productHtml.includes("Ayuda publica y reglas utiles antes de comprar") &&
        productHtml.includes("Abrir help center") &&
        productHtml.includes("Ver policies"),
      `status=${productResponse.status}`,
      "La ficha debe exponer una integracion contextual entre ayuda publica y decision comercial."
    );

    recordCase(
      results,
      "ficha_enlaza_articulo_relacionado_precompra",
      "critical",
      productResponse.status === 200 &&
        productHtml.includes(`data-commerce-help-article="${article.slug}"`) &&
        productHtml.includes(`/help/article/${article.slug}`) &&
        productHtml.includes(article.title),
      `status=${productResponse.status}`,
      "La ficha debe conectar con ayuda editorial relacionada al producto."
    );

    recordCase(
      results,
      "ficha_enlaza_policy_publica_relevante",
      "critical",
      productResponse.status === 200 &&
        productHtml.includes(`data-commerce-help-policy="${policy.policy_key}"`) &&
        productHtml.includes(`/policies/${policy.policy_key}`) &&
        productHtml.includes(policy.title),
      `status=${productResponse.status}`,
      "La ficha debe conectar con una policy publica relevante para la compra."
    );

    const articleResponse = await request(`/help/article/${article.slug}`);
    const articleHtml = normalizeHtml(await articleResponse.text());
    recordCase(
      results,
      "articulo_relacionado_mantiene_continuidad_hacia_producto",
      "critical",
      articleResponse.status === 200 &&
        articleHtml.includes(`/products/${product.slug}`) &&
        articleHtml.includes(product.title),
      `status=${articleResponse.status}`,
      "El articulo relacionado debe mantener continuidad de vuelta al producto."
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      throw new Error(
        `QA editorial help-commerce con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
