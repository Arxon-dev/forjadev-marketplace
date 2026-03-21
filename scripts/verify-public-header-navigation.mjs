import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

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

const PORT = Number(process.env.PUBLIC_HEADER_QA_PORT || 3264);
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function request(pathname, options = {}) {
  return fetch(`${BASE_URL}${pathname}`, {
    redirect: "manual",
    ...options,
  });
}

async function waitForServer(timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("No se pudo iniciar el servidor local para la QA del header publico.");
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
      `No se pudo iniciar el servidor local para la QA del header publico. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
    );
  }

  return child;
}

async function main() {
  const results = [];
  let server = null;

  try {
    server = await startServer();

    const homeHtml = normalizeHtml(await (await request("/")).text());
    recordCase(
      results,
      "header_publico_expone_branding_search_y_navegacion_primaria",
      "critical",
      homeHtml.includes("ForjaDev") &&
        homeHtml.includes("Marketplace premium") &&
        homeHtml.includes("Buscar plugins, mapas, bundles o compatibilidad") &&
        homeHtml.includes("/products") &&
        homeHtml.includes("/categories") &&
        homeHtml.includes("/games"),
      "home_header",
      "Home debe abrir con un header premium que una branding, search y browse comercial."
    );

    const productsHtml = normalizeHtml(await (await request("/products")).text());
    recordCase(
      results,
      "header_refuerza_estado_activo_en_catalogo",
      "critical",
      productsHtml.includes("Productos") &&
        productsHtml.includes("/products") &&
        productsHtml.includes("/bundles") &&
        productsHtml.includes("/deals") &&
        productsHtml.includes("Buscar plugins, mapas, bundles o compatibilidad"),
      "products_header",
      "El catalogo debe mostrar estado activo y continuidad clara desde la cabecera."
    );

    const dealsHtml = normalizeHtml(await (await request("/deals")).text());
    recordCase(
      results,
      "header_mantiene_descubrimiento_hacia_surfaces_comerciales",
      "critical",
      dealsHtml.includes('href="/bundles"') &&
        dealsHtml.includes('href="/categories"') &&
        dealsHtml.includes('href="/games"'),
      "deals_header",
      "Deals debe seguir conectado a las rutas principales de discovery desde el header."
    );

    const searchResponse = await request("/products?q=rust");
    const searchHtml = normalizeHtml(await searchResponse.text());
    recordCase(
      results,
      "header_search_dirige_a_catalogo_publico",
      "critical",
      searchResponse.status === 200 &&
        searchHtml.includes("Buscar plugins, mapas, bundles o compatibilidad") &&
        searchHtml.includes("/products"),
      `search_status=${searchResponse.status}`,
      "La busqueda del header debe mantener continuidad dentro del catalogo publico."
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      throw new Error(
        `QA del header publico con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
