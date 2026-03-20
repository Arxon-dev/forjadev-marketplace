import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filepath) {
  if (!fs.existsSync(filepath)) {
    return;
  }

  const content = fs.readFileSync(filepath, "utf8");
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

const projectRoot = process.cwd();
loadEnvFile(path.join(projectRoot, ".env.local"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.EDITORIAL_QA_BASE_URL || "http://127.0.0.1:3000";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan variables de entorno de Supabase para la verificacion editorial.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const QA_ADMIN_EMAIL = "qa-editorial-admin@forjadev.local";
const QA_BUYER_EMAIL = "qa-editorial-buyer@forjadev.local";
const QA_PASSWORD = "ForjaDevQA!2026";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getCookieHeaderFromResponse(response) {
  const setCookies = response.headers.getSetCookie?.() || [];
  return setCookies.map((value) => value.split(";")[0]).join("; ");
}

async function request(pathname, options = {}) {
  return fetch(`${BASE_URL}${pathname}`, {
    redirect: "manual",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });
}

async function ensureUser(email, role) {
  const {
    data: { users },
    error: listError,
  } = await adminSupabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw listError;
  }

  let user = users.find((entry) => entry.email === email) || null;

  if (!user) {
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email,
      password: QA_PASSWORD,
      email_confirm: true,
    });

    if (error || !data.user) {
      throw error || new Error(`No se pudo crear el usuario QA ${email}`);
    }

    user = data.user;
  }

  const { error: profileError } = await adminSupabase
    .from("profiles")
    .update({
      email,
      username: email.split("@")[0],
      display_name: role === "admin" ? "QA Editorial Admin" : "QA Editorial Buyer",
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    throw profileError;
  }

  return user;
}

async function login(identifier, password) {
  const response = await request("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier, password }),
  });

  const payload = await response.json().catch(() => ({}));
  assert(response.ok, `No se pudo iniciar sesion para ${identifier}: ${payload.error || response.status}`);

  return getCookieHeaderFromResponse(response);
}

async function createDraftFixtures(adminCookieHeader, suffix) {
  const categoryResponse = await request("/api/admin/editorial/categories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookieHeader,
    },
    body: JSON.stringify({
      title: `QA Editorial ${suffix}`,
      slug: `qa-editorial-${suffix}`,
      description: "Categoria draft para verificacion de preview y permisos.",
      icon: "shield-check",
      sortOrder: "999",
      status: "draft",
    }),
  });
  const categoryPayload = await categoryResponse.json();
  assert(
    categoryResponse.ok && categoryPayload.id,
    `No se pudo crear la categoria draft QA: ${categoryPayload.message || categoryResponse.status}`
  );

  const articleResponse = await request("/api/admin/editorial/articles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookieHeader,
    },
    body: JSON.stringify({
      categoryId: categoryPayload.id,
      title: `QA Article ${suffix}`,
      slug: `qa-article-${suffix}`,
      summary: "Resumen QA para preview.",
      body: "Contenido QA para verificar preview segura y no exposicion publica.",
      audience: "buyer",
      articleType: "guide",
      status: "draft",
      sortOrder: "999",
      isFeatured: false,
    }),
  });
  const articlePayload = await articleResponse.json();
  assert(
    articleResponse.ok && articlePayload.id,
    `No se pudo crear el articulo draft QA: ${articlePayload.message || articleResponse.status}`
  );

  const policyResponse = await request("/api/admin/editorial/policies", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookieHeader,
    },
    body: JSON.stringify({
      title: `QA Policy ${suffix}`,
      policyKey: `qa-policy-${suffix}`,
      summary: "Resumen QA para policy draft.",
      body: "Contenido QA para policy draft y preview segura.",
      audience: "shared",
      status: "draft",
      sortOrder: "999",
    }),
  });
  const policyPayload = await policyResponse.json();
  assert(
    policyResponse.ok && policyPayload.id,
    `No se pudo crear la policy draft QA: ${policyPayload.message || policyResponse.status}`
  );

  return {
    category: { id: categoryPayload.id, slug: `qa-editorial-${suffix}` },
    article: { id: articlePayload.id, slug: `qa-article-${suffix}` },
    policy: { id: policyPayload.id, key: `qa-policy-${suffix}` },
  };
}

async function cleanupDraftFixtures(fixtures) {
  if (!fixtures) return;

  await adminSupabase.from("help_center_articles").delete().eq("id", fixtures.article.id);
  await adminSupabase.from("marketplace_policy_pages").delete().eq("id", fixtures.policy.id);
  await adminSupabase.from("help_center_categories").delete().eq("id", fixtures.category.id);
}

async function getPublishedEditorialTargets() {
  const [{ data: category }, { data: article }, { data: policy }] = await Promise.all([
    adminSupabase
      .from("help_center_categories")
      .select("id, slug")
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
    adminSupabase
      .from("help_center_articles")
      .select("id, slug")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminSupabase
      .from("marketplace_policy_pages")
      .select("id, policy_key")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  assert(category && article && policy, "No hay contenido publicado suficiente para la verificacion QA.");
  return { category, article, policy };
}

async function assertEditorialSchemaReady() {
  const [{ error: categoryError }, { error: articleError }, { error: policyError }] =
    await Promise.all([
      adminSupabase.from("help_center_categories").select("id, status").limit(1),
      adminSupabase.from("help_center_articles").select("id, seo_title").limit(1),
      adminSupabase
        .from("marketplace_policy_pages")
        .select("id, seo_title")
        .limit(1),
    ]);

  const schemaError = categoryError || articleError || policyError;
  const schemaErrorMessage = schemaError?.message || "Esquema remoto incompleto o no accesible.";

  assert(
    !schemaError,
    `El esquema remoto no esta alineado con el modulo editorial actual. Aplica las migraciones 0034 y 0035 antes de ejecutar la QA real. Detalle: ${schemaErrorMessage}`
  );
}

async function main() {
  console.log(`Verificando guardrails editoriales contra ${BASE_URL}`);

  const fixturesSuffix = Date.now().toString(36);
  let fixtures = null;

  try {
    await assertEditorialSchemaReady();

    const [adminUser, buyerUser] = await Promise.all([
      ensureUser(QA_ADMIN_EMAIL, "admin"),
      ensureUser(QA_BUYER_EMAIL, "buyer"),
    ]);

    assert(adminUser.id !== buyerUser.id, "Los usuarios QA deben ser distintos.");

    const anonAdminPage = await request("/admin/editorial");
    assert(
      [302, 307].includes(anonAdminPage.status) &&
        (anonAdminPage.headers.get("location") || "").includes("/login"),
      "El usuario anonimo deberia ser redirigido a /login en /admin/editorial."
    );

    const anonApi = await request("/api/admin/editorial/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert(anonApi.status === 401, "La API editorial admin debe devolver 401 a anonimo.");

    const buyerCookies = await login(QA_BUYER_EMAIL, QA_PASSWORD);
    const buyerAdminPage = await request("/admin/editorial", {
      headers: { Cookie: buyerCookies },
    });
    assert(
      [302, 307].includes(buyerAdminPage.status) &&
        (buyerAdminPage.headers.get("location") || "").includes("/dashboard"),
      "El usuario autenticado no admin deberia ser redirigido a /dashboard."
    );

    const buyerApi = await request("/api/admin/editorial/categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: buyerCookies,
      },
      body: JSON.stringify({}),
    });
    assert(buyerApi.status === 403, "La API editorial admin debe devolver 403 a buyer.");

    const adminCookies = await login(QA_ADMIN_EMAIL, QA_PASSWORD);
    const adminPage = await request("/admin/editorial", {
      headers: { Cookie: adminCookies },
    });
    const adminHtml = await adminPage.text();
    assert(
      adminPage.status === 200 && adminHtml.includes("Editorial Ops"),
      "El admin autenticado debe poder abrir /admin/editorial."
    );

    fixtures = await createDraftFixtures(adminCookies, fixturesSuffix);

    const adminPreviewCategory = await request(
      `/admin/editorial/categories/${fixtures.category.id}/preview`,
      { headers: { Cookie: adminCookies } }
    );
    assert(adminPreviewCategory.status === 200, "La preview admin de categoria debe responder 200.");

    const adminPreviewArticle = await request(
      `/admin/editorial/articles/${fixtures.article.id}/preview`,
      { headers: { Cookie: adminCookies } }
    );
    assert(adminPreviewArticle.status === 200, "La preview admin de articulo debe responder 200.");

    const adminPreviewPolicy = await request(
      `/admin/editorial/policies/${fixtures.policy.id}/preview`,
      { headers: { Cookie: adminCookies } }
    );
    assert(adminPreviewPolicy.status === 200, "La preview admin de policy debe responder 200.");

    const buyerPreview = await request(
      `/admin/editorial/articles/${fixtures.article.id}/preview`,
      { headers: { Cookie: buyerCookies } }
    );
    assert(
      [302, 307].includes(buyerPreview.status) &&
        (buyerPreview.headers.get("location") || "").includes("/dashboard"),
      "El buyer no admin no debe poder abrir preview admin."
    );

    const anonPreview = await request(`/admin/editorial/articles/${fixtures.article.id}/preview`);
    assert(
      [302, 307].includes(anonPreview.status) &&
        (anonPreview.headers.get("location") || "").includes("/login"),
      "El anonimo no debe poder abrir preview admin."
    );

    const publicDraftCategory = await request(`/help/${fixtures.category.slug}`);
    const publicDraftArticle = await request(`/help/article/${fixtures.article.slug}`);
    const publicDraftPolicy = await request(`/policies/${fixtures.policy.key}`);
    assert(publicDraftCategory.status === 404, "Una categoria draft no debe ser publica.");
    assert(publicDraftArticle.status === 404, "Un articulo draft no debe ser publico.");
    assert(publicDraftPolicy.status === 404, "Una policy draft no debe ser publica.");

    const publishedTargets = await getPublishedEditorialTargets();

    const categorySlugPatch = await request(
      `/api/admin/editorial/categories/${publishedTargets.category.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookies,
        },
        body: JSON.stringify({ slug: `${publishedTargets.category.slug}-qa-lock` }),
      }
    );
    assert(categorySlugPatch.status === 409, "El slug de categoria publicada debe quedar bloqueado.");

    const articleSlugPatch = await request(
      `/api/admin/editorial/articles/${publishedTargets.article.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookies,
        },
        body: JSON.stringify({ slug: `${publishedTargets.article.slug}-qa-lock` }),
      }
    );
    assert(articleSlugPatch.status === 409, "El slug de articulo publicado debe quedar bloqueado.");

    const policyKeyPatch = await request(
      `/api/admin/editorial/policies/${publishedTargets.policy.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookies,
        },
        body: JSON.stringify({ policyKey: `${publishedTargets.policy.policy_key}-qa-lock` }),
      }
    );
    assert(policyKeyPatch.status === 409, "La clave publica de policy publicada debe quedar bloqueada.");

    console.log("OK: preview admin segura, permisos reales y guardrails de slugs verificados.");
  } finally {
    await cleanupDraftFixtures(fixtures);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
