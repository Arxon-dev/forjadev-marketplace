import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function assertEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable ${name}`);
  }

  return value;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();

  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { response, body };
}

async function runCheck(label, execute) {
  try {
    const detail = await execute();
    console.log(`PASS ${label}${detail ? ` - ${detail}` : ""}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL ${label} - ${message}`);
    return false;
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));

  const supabaseUrl = assertEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = assertEnv("SUPABASE_SERVICE_ROLE_KEY");

  const results = await Promise.all([
    runCheck("public approved products query", async () => {
      const url = new URL("/rest/v1/products", supabaseUrl);
      url.searchParams.set("select", "id,slug,moderation_status");
      url.searchParams.set("moderation_status", "eq.approved");
      url.searchParams.set("limit", "1");

      const { response, body } = await requestJson(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return Array.isArray(body) ? `${body.length} rows` : "query ok";
    }),
    runCheck("checkout RPC exists and enforces auth", async () => {
      const url = new URL("/rest/v1/rpc/create_checkout_order", supabaseUrl);

      const { response, body } = await requestJson(url, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_product_id: "00000000-0000-0000-0000-000000000000",
        }),
      });

      if (response.status !== 400) {
        throw new Error(`Esperaba 400 y recibi ${response.status}`);
      }

      if (!body || typeof body !== "object" || body.message !== "Necesitas iniciar sesion") {
        throw new Error("La funcion no devolvio la validacion de auth esperada");
      }

      return "RPC operativa";
    }),
    runCheck("audit logs available with service role", async () => {
      const url = new URL("/rest/v1/audit_logs", supabaseUrl);
      url.searchParams.set("select", "id,action,entity_type,created_at");
      url.searchParams.set("order", "created_at.desc");
      url.searchParams.set("limit", "5");

      const { response, body } = await requestJson(url, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return Array.isArray(body) ? `${body.length} logs recientes` : "lectura ok";
    }),
    runCheck("licenses table reachable with service role", async () => {
      const url = new URL("/rest/v1/licenses", supabaseUrl);
      url.searchParams.set("select", "id,status,product_id,user_id");
      url.searchParams.set("limit", "1");

      const { response, body } = await requestJson(url, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return Array.isArray(body) ? `${body.length} rows inspeccionadas` : "lectura ok";
    }),
  ]);

  if (results.some((result) => !result)) {
    process.exitCode = 1;
    return;
  }

  console.log("Smoke check completado correctamente");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
