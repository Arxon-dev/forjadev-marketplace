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
  throw new Error("Faltan variables de entorno de Supabase para la QA collections feed engagement loop.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.COLLECTIONS_FEED_ENGAGEMENT_QA_PORT || 3236);
const BASE_URL = `http://127.0.0.1:${PORT}`;
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
      const response = await fetch(`${BASE_URL}/feed`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("No se pudo iniciar el servidor local para la QA collections feed engagement loop.");
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
      `No se pudo iniciar el servidor local para la QA collections feed engagement loop. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
        store_name: "QA Loop Seller",
        slug: `qa-loop-seller-${seed}`,
        bio: "QA seller for collections/feed engagement loop.",
      },
    ])
    .select("id")
    .single();

  if (error || !vendor) {
    throw error || new Error("No se pudo crear el vendor QA loop.");
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
        description: `${name} QA loop.`,
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
        short_description: `${title} QA loop product.`,
        description: `${title} QA loop product description.`,
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

async function createCollection({ userId, title, slug, isPublic }) {
  const { data: collection, error } = await adminSupabase
    .from("collections")
    .insert([
      {
        user_id: userId,
        title,
        slug,
        description: `${title} QA collection.`,
        is_public: isPublic,
      },
    ])
    .select("id, slug")
    .single();

  if (error || !collection) {
    throw error || new Error(`No se pudo crear la coleccion ${title}.`);
  }

  return collection;
}

async function addProductToCollection(collectionId, productId, sortOrder = 0) {
  const { error } = await adminSupabase.from("collection_items").upsert([
    {
      collection_id: collectionId,
      product_id: productId,
      sort_order: sortOrder,
    },
  ], { onConflict: "collection_id,product_id" });

  if (error) {
    throw error;
  }
}

async function addWishlist(userId, productId) {
  const { error } = await adminSupabase.from("wishlists").upsert([
    {
      user_id: userId,
      product_id: productId,
    },
  ], { onConflict: "user_id,product_id" });

  if (error) {
    throw error;
  }
}

async function addFollow(userId, vendorId) {
  const { error } = await adminSupabase.from("seller_followers").upsert([
    {
      user_id: userId,
      vendor_id: vendorId,
    },
  ], { onConflict: "user_id,vendor_id" });

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

async function login(identifier, password) {
  const cookieJar = new Map();
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ identifier, password }),
  });
  collectCookies(response, cookieJar);

  return {
    status: response.status,
    cookie: serializeCookies(cookieJar),
  };
}

async function main() {
  const results = [];
  let server = null;

  try {
    const seed = Date.now();
    const sellerEmail = `qa-loop-seller-${seed}@forjadev.local`;
    const buyerEmail = `qa-loop-buyer-${seed}@forjadev.local`;
    const curatorEmail = `qa-loop-curator-${seed}@forjadev.local`;
    const emptyBuyerEmail = `qa-loop-empty-${seed}@forjadev.local`;
    const seller = await ensureUser({
      email: sellerEmail,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Loop Seller",
      username: `qa_loop_seller_${seed}`,
    });
    const buyer = await ensureUser({
      email: buyerEmail,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Loop Buyer",
      username: `qa_loop_buyer_${seed}`,
    });
    const curator = await ensureUser({
      email: curatorEmail,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Loop Curator",
      username: `qa_loop_curator_${seed}`,
    });
    await ensureUser({
      email: emptyBuyerEmail,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Loop Empty",
      username: `qa_loop_empty_${seed}`,
    });

    const vendor = await ensureVendor(seller.id, seed);
    const category = await createCategory({
      name: `QA Loop Category ${seed}`,
      slug: `qa-loop-category-${seed}`,
      sortOrder: 30,
    });
    const game = await createGame({
      name: `QA Loop Game ${seed}`,
      slug: `qa-loop-game-${seed}`,
      sortOrder: 30,
    });
    const productA = await createApprovedProduct({
      vendorId: vendor.id,
      categoryId: category.id,
      gameId: game.id,
      title: `QA Loop Product A ${seed}`,
      slug: `qa-loop-product-a-${seed}`,
      priceCents: 1900,
    });
    const productB = await createApprovedProduct({
      vendorId: vendor.id,
      categoryId: category.id,
      gameId: game.id,
      title: `QA Loop Product B ${seed}`,
      slug: `qa-loop-product-b-${seed}`,
      priceCents: 2100,
    });

    const relevantCollection = await createCollection({
      userId: curator.id,
      title: `QA Loop Public Collection ${seed}`,
      slug: `qa-loop-public-collection-${seed}`,
      isPublic: true,
    });
    const ownCollection = await createCollection({
      userId: buyer.id,
      title: `QA Loop Own Collection ${seed}`,
      slug: `qa-loop-own-collection-${seed}`,
      isPublic: false,
    });

    await addProductToCollection(relevantCollection.id, productA.id, 0);
    await addProductToCollection(relevantCollection.id, productB.id, 1);
    await addProductToCollection(ownCollection.id, productA.id, 0);
    await addWishlist(buyer.id, productA.id);
    await addFollow(buyer.id, vendor.id);

    server = await startServer();

    const anonymousFeed = await request("/feed");
    const anonymousHtml = normalizeHtml(await anonymousFeed.text());
    recordCase(
      results,
      "feed_anonimo_exige_autenticacion_con_contexto",
      "critical",
      (anonymousFeed.status === 307 &&
        (anonymousFeed.headers.get("location") || "").includes("/login")) ||
        (anonymousFeed.status === 200 && anonymousHtml.includes("Necesitas iniciar sesion")),
      `status=${anonymousFeed.status}`,
      "El feed debe seguir siendo un destino autenticado con explicacion clara."
    );

    const buyerLogin = await login(buyerEmail, QA_PASSWORD);
    const buyerFeed = await request("/feed", {
      headers: buyerLogin.cookie ? { cookie: buyerLogin.cookie } : {},
    });
    const buyerFeedHtml = normalizeHtml(await buyerFeed.text());
    recordCase(
      results,
      "feed_muestra_snapshot_del_loop_de_engagement",
      "critical",
      buyerLogin.status === 200 &&
        buyerFeed.status === 200 &&
        buyerFeedHtml.includes("Tu senal de retorno") &&
        buyerFeedHtml.includes("1 guardados") &&
        buyerFeedHtml.includes("1 sellers seguidos") &&
        buyerFeedHtml.includes("1 colecciones tuyas"),
      `login=${buyerLogin.status}, feed=${buyerFeed.status}`,
      "El buyer con senal sembrada debe ver el resumen operativo del loop."
    );

    recordCase(
      results,
      "feed_expone_colecciones_relevantes_con_continuidad_a_producto",
      "critical",
      buyerFeedHtml.includes('data-engagement-loop="relevant-collection"') &&
        buyerFeedHtml.includes(relevantCollection.slug) &&
        buyerFeedHtml.includes(productA.title) &&
        buyerFeedHtml.includes("1 match en wishlist"),
      "relevant_collection_section",
      "El feed debe convertir wishlist en colecciones relevantes y enlaces utiles."
    );

    const emptyBuyerLogin = await login(emptyBuyerEmail, QA_PASSWORD);
    const emptyBuyerFeed = await request("/feed", {
      headers: emptyBuyerLogin.cookie ? { cookie: emptyBuyerLogin.cookie } : {},
    });
    const emptyBuyerHtml = normalizeHtml(await emptyBuyerFeed.text());
    recordCase(
      results,
      "feed_vacio_muestra_activacion_clara_del_loop",
      "critical",
      emptyBuyerLogin.status === 200 &&
        emptyBuyerFeed.status === 200 &&
        emptyBuyerHtml.includes("Activa el loop de retorno") &&
        emptyBuyerHtml.includes('href="/products"') &&
        emptyBuyerHtml.includes('href="/collections"'),
      `login=${emptyBuyerLogin.status}, feed=${emptyBuyerFeed.status}`,
      "El buyer sin senal debe ver una activacion clara en lugar de un feed accesorio."
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      console.log(JSON.stringify({ results }, null, 2));
      throw new Error(
        `QA collections feed engagement loop con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
