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

const PORT = Number(process.env.PUBLIC_HOME_HERO_QA_PORT || 3265);
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
  throw new Error("No se pudo iniciar el servidor local para la QA de home publica.");
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
      `No se pudo iniciar el servidor local para la QA de home publica. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
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
      "home_abre_con_hero_editorial_premium",
      "critical",
      homeHtml.includes('data-commerce-stage="home-hero"') &&
        homeHtml.includes("Marketplace editorial premium") &&
        homeHtml.includes("Descubre recursos premium para servidores") &&
        homeHtml.includes("Compra con contexto, no desde una home decorativa"),
      "home_hero",
      "La home debe abrir con un hero editorial y comercial claramente premium."
    );

    recordCase(
      results,
      "home_refuerza_cta_hierarchy",
      "critical",
      homeHtml.includes("Explorar catalogo") &&
        homeHtml.includes("Ver deals activos") &&
        homeHtml.includes("Comparar bundles"),
      "hero_ctas",
      "El hero debe dejar clara la jerarquia entre catalogo, deals y bundles."
    );

    recordCase(
      results,
      "home_conecta_a_surfaces_clave_desde_el_arranque",
      "critical",
      homeHtml.includes("/deals") &&
        homeHtml.includes("/bundles") &&
        homeHtml.includes("/categories") &&
        homeHtml.includes("Continuidad editorial"),
      "hero_continuity",
      "El arranque comercial debe enlazar con deals, bundles y taxonomia sin friccion."
    );

    recordCase(
      results,
      "home_mantiene_integracion_con_sections_existentes",
      "critical",
      homeHtml.includes('data-commerce-section="home-categories"') &&
        homeHtml.includes("Placements premium") &&
        homeHtml.includes("Deals activos") &&
        homeHtml.includes("Destacados"),
      "home_sections",
      "La nueva apertura no debe romper la continuidad con categorias y rails ya existentes."
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      throw new Error(
        `QA de home publica con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
