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
  throw new Error("Faltan variables de entorno de Supabase para la QA account control center.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.ACCOUNT_CONTROL_CENTER_QA_PORT || 3237);
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
      const response = await fetch(`${BASE_URL}/account`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("No se pudo iniciar el servidor local para la QA account control center.");
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
      `No se pudo iniciar el servidor local para la QA account control center. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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

async function ensureNotification(userId, seed) {
  const { error } = await adminSupabase.from("user_notifications").insert([
    {
      recipient_user_id: userId,
      kind: "account.qa",
      title: `QA Account Notification ${seed}`,
      body: "QA notification for account control center.",
      is_read: false,
    },
  ]);

  if (error) {
    throw error;
  }
}

async function ensureLinkedIdentity(userId, provider, seed) {
  const { error } = await adminSupabase.from("user_provider_identities").upsert(
    [
      {
        user_id: userId,
        provider,
        provider_user_id: `${provider}-qa-${seed}`,
        provider_email: `${provider}-${seed}@forjadev.local`,
        provider_username: `qa_${provider}_${seed}`,
      },
    ],
    { onConflict: "provider,provider_user_id" }
  );

  if (error) {
    throw error;
  }
}

async function ensureWishlist(userId) {
  const { data: product } = await adminSupabase
    .from("products")
    .select("id")
    .eq("moderation_status", "approved")
    .limit(1)
    .maybeSingle();

  if (!product) {
    return;
  }

  await adminSupabase.from("wishlists").upsert(
    [
      {
        user_id: userId,
        product_id: product.id,
      },
    ],
    { onConflict: "user_id,product_id" }
  );
}

async function ensureCollection(userId, seed) {
  await adminSupabase.from("collections").insert([
    {
      user_id: userId,
      title: `QA Account Collection ${seed}`,
      slug: `qa-account-collection-${seed}`,
      description: "QA collection for account center.",
      is_public: false,
    },
  ]);
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
    const userEmail = `qa-account-user-${seed}@forjadev.local`;
    const emptyEmail = `qa-account-empty-${seed}@forjadev.local`;

    const user = await ensureUser({
      email: userEmail,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Account User",
      username: `qa_account_user_${seed}`,
    });
    await ensureUser({
      email: emptyEmail,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Account Empty",
      username: `qa_account_empty_${seed}`,
    });

    await Promise.all([
      ensureNotification(user.id, seed),
      ensureLinkedIdentity(user.id, "discord", seed),
      ensureWishlist(user.id),
      ensureCollection(user.id, seed),
    ]);

    server = await startServer();

    const anonymousAccount = await request("/account");
    recordCase(
      results,
      "account_anonimo_redirige_a_login",
      "critical",
      anonymousAccount.status === 307 &&
        (anonymousAccount.headers.get("location") || "").includes("/login"),
      `status=${anonymousAccount.status}`,
      "La ruta /account debe estar protegida por autenticacion."
    );

    const loginResult = await login(userEmail, QA_PASSWORD);
    const accountResponse = await request("/account", {
      headers: loginResult.cookie ? { cookie: loginResult.cookie } : {},
    });
    const accountHtml = normalizeHtml(await accountResponse.text());
    recordCase(
      results,
      "account_renderiza_como_centro_de_control_real",
      "critical",
      loginResult.status === 200 &&
        accountResponse.status === 200 &&
        accountHtml.includes('data-account-center="profile"') &&
        accountHtml.includes('data-account-center="shortcuts"') &&
        accountHtml.includes('data-account-center="identities"') &&
        accountHtml.includes("Cuenta"),
      `login=${loginResult.status}, account=${accountResponse.status}`,
      "La cuenta debe renderizar identidad editable, accesos y conexiones."
    );

    const patchResponse = await request("/api/account/profile", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(loginResult.cookie ? { cookie: loginResult.cookie } : {}),
      },
      body: JSON.stringify({
        displayName: "QA Account Updated",
        username: `qaaccountupdated${seed}`,
      }),
    });
    const patchPayload = await patchResponse.json().catch(() => null);
    const { data: profileRow } = await adminSupabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .single();
    recordCase(
      results,
      "account_actualiza_identidad_visible",
      "critical",
      patchResponse.status === 200 &&
        profileRow?.display_name === "QA Account Updated" &&
        profileRow?.username === `qaaccountupdated${seed}`,
      `patch=${patchResponse.status}`,
      patchPayload?.error || "La cuenta debe permitir actualizar display_name y username."
    );

    recordCase(
      results,
      "account_conecta_con_superficies_clave_del_marketplace",
      "critical",
      accountHtml.includes('href="/orders"') &&
        accountHtml.includes('href="/licenses"') &&
        accountHtml.includes('href="/feed"') &&
        accountHtml.includes('href="/collections"'),
      "shortcut_links",
      "La cuenta debe servir como centro de continuidad hacia compras, licencias, feed y colecciones."
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      console.log(JSON.stringify({ results }, null, 2));
      throw new Error(
        `QA account control center con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
