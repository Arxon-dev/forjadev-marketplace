import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function normalizeHtml(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();
}

function includesCreatorReplyCount(html) {
  return /\d+\s+del creador/.test(html);
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan variables de entorno de Supabase para la QA product discussions trust layer.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.PRODUCT_DISCUSSIONS_QA_PORT || 3239);
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
  throw new Error("No se pudo iniciar el servidor local para la QA product discussions trust layer.");
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
      `No se pudo iniciar el servidor local para la QA product discussions trust layer. stdout=${stdout.trim() || "<empty>"} stderr=${stderr.trim() || "<empty>"}`
    );
  }

  return child;
}

async function ensureDiscussionWithSellerReply(seed) {
  const { data: product, error: productError } = await adminSupabase
    .from("products")
    .select("id, slug, title, vendor_id, moderation_status")
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (productError || !product) throw productError || new Error("No hay producto aprobado para QA.");

  const { data: vendor, error: vendorError } = await adminSupabase
    .from("vendors")
    .select("id, user_id")
    .eq("id", product.vendor_id)
    .single();

  if (vendorError || !vendor) throw vendorError || new Error("No hay vendor asociado para QA.");

  const { data: buyerUser, error: buyerUserError } = await adminSupabase.auth.admin.createUser({
    email: `qa-discussion-buyer-${seed}@forjadev.local`,
    password: "ForjaDevQA!2026",
    email_confirm: true,
  });

  if (buyerUserError || !buyerUser.user) {
    throw buyerUserError || new Error("No se pudo crear buyer QA.");
  }

  const buyerId = buyerUser.user.id;

  await adminSupabase.from("profiles").upsert([
    {
      id: buyerId,
      email: `qa-discussion-buyer-${seed}@forjadev.local`,
      username: `qa_discussion_buyer_${seed}`,
      display_name: "QA Discussion Buyer",
      role: "buyer",
    },
  ]);

  const { data: discussion, error: discussionError } = await adminSupabase
    .from("product_discussions")
    .insert([
      {
        product_id: product.id,
        author_user_id: buyerId,
        title: `QA Discussion ${seed}`,
        body: "Quiero confirmar si el producto sigue activo y si el seller responde dudas precompra.",
        is_pinned: false,
        is_locked: false,
      },
    ])
    .select("id, title")
    .single();

  if (discussionError || !discussion) {
    throw discussionError || new Error("No se pudo crear la discusion QA.");
  }

  const { error: replyError } = await adminSupabase.from("discussion_messages").insert([
    {
      discussion_id: discussion.id,
      author_user_id: vendor.user_id,
      body: "Si, el producto sigue mantenido y la compatibilidad actual ya esta validada por el seller.",
    },
    {
      discussion_id: discussion.id,
      author_user_id: buyerId,
      body: "Perfecto, gracias por la aclaracion.",
    },
  ]);

  if (replyError) throw replyError;

  return {
    productSlug: product.slug,
    discussionId: discussion.id,
    discussionTitle: discussion.title,
  };
}

async function main() {
  const results = [];
  let server = null;

  try {
    const seed = Date.now();
    const context = await ensureDiscussionWithSellerReply(seed);
    server = await startServer();

    const productResponse = await request(`/products/${context.productSlug}`);
    const productHtml = normalizeHtml(await productResponse.text());
    recordCase(
      results,
      "ficha_muestra_discusion_como_capa_de_confianza",
      "critical",
      productResponse.status === 200 &&
        productHtml.includes("Discusiones del producto") &&
        productHtml.includes("Respondida por seller") &&
        productHtml.includes("Estado del hilo"),
      `status=${productResponse.status}`,
      "La ficha debe convertir la discusion en trust layer legible."
    );

    recordCase(
      results,
      "ficha_explica_estado_y_contexto_del_hilo",
      "critical",
      productHtml.includes("respondida por el creador") &&
        productHtml.includes("Ya hay respuesta del creador") &&
        includesCreatorReplyCount(productHtml),
      context.discussionTitle,
      "La ficha debe explicar si el seller ya respondio y por que eso ayuda a decidir compra."
    );

    const detailResponse = await request(
      `/products/${context.productSlug}/discussions/${context.discussionId}`
    );
    const detailHtml = normalizeHtml(await detailResponse.text());
    recordCase(
      results,
      "detalle_identifica_respuestas_del_seller",
      "critical",
      detailResponse.status === 200 &&
        detailHtml.includes("Respondida por seller") &&
        detailHtml.includes("Seller") &&
        detailHtml.includes("Lectura de confianza"),
      `status=${detailResponse.status}`,
      "El detalle debe dejar claro cuando el seller participa en la conversacion."
    );

    recordCase(
      results,
      "detalle_mantiene_continuidad_con_producto",
      "critical",
      detailHtml.includes(`href="/products/${context.productSlug}"`) &&
        detailHtml.includes("Volver al producto"),
      context.productSlug,
      "La conversacion debe seguir conectada con la ficha y el shopping journey."
    );

    const failed = results.filter((result) => result.status === "FAIL");
    if (failed.length > 0) {
      console.log(JSON.stringify({ results }, null, 2));
      throw new Error(
        `QA product discussions trust layer con ${failed.length} FAIL: ${failed.map((item) => item.name).join(", ")}`
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
