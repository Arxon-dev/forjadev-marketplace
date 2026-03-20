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

const projectRoot = process.cwd();
loadEnvFile(resolve(projectRoot, ".env.local"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan variables de entorno de Supabase para la QA del lifecycle de releases.");
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PORT = Number(process.env.RELEASE_QA_PORT || 3212);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const QA_PASSWORD = "ForjaDevQA!2026";
const OWNER_EMAIL = "qa-release-owner@forjadev.local";
const OTHER_SELLER_EMAIL = "qa-release-other@forjadev.local";
const BUYER_EMAIL = "qa-release-buyer@forjadev.local";
const ADMIN_EMAIL = "qa-editorial-admin@forjadev.local";

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

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/login`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // retry
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }

  throw new Error("No se pudo iniciar el servidor local para la QA del lifecycle.");
}

async function startServer() {
  const child = spawn(process.execPath, ["qa-release-server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
    },
    stdio: "ignore",
  });

  await waitForServer();
  return child;
}

async function ensureUser({ email, password, role, displayName, username }) {
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
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      throw error || new Error(`No se pudo crear el usuario ${email}`);
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

  const profilesQuery = adminSupabase.from("profiles");
  const { data: existingProfile } = await profilesQuery.select("id").eq("id", user.id).maybeSingle();

  if (existingProfile) {
    const { error } = await profilesQuery
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
    const { error } = await profilesQuery.insert([
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

async function ensureVendor(userId, slugPrefix, storeName) {
  const vendorsQuery = adminSupabase.from("vendors");
  const { data: existingVendor } = await vendorsQuery
    .select("id, slug")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingVendor) {
    return existingVendor;
  }

  const slug = `${slugPrefix}-${Date.now()}`;
  const { data: insertedVendor, error } = await vendorsQuery
    .insert([
      {
        user_id: userId,
        store_name: storeName,
        slug,
        bio: `${storeName} QA`,
      },
    ])
    .select("id, slug")
    .single();

  if (error || !insertedVendor) {
    throw error || new Error(`No se pudo crear el vendor para ${storeName}`);
  }

  return insertedVendor;
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

  if (!response.ok) {
    throw new Error(`No se pudo iniciar sesion para ${identifier}: ${payload.error || response.status}`);
  }

  return getCookieHeaderFromResponse(response);
}

async function uploadStorageZip({ vendorId, productId, versionId, fileName, contents }) {
  const filePath = `${vendorId}/${productId}/${versionId}/${fileName}`;
  const { error } = await adminSupabase.storage.from("product-files").upload(filePath, contents, {
    contentType: "application/zip",
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return filePath;
}

async function deleteOldQaProducts(vendorId) {
  const productsQuery = adminSupabase.from("products");
  const { data: oldProducts } = await productsQuery
    .select("id")
    .eq("vendor_id", vendorId)
    .ilike("slug", "qa-release-lifecycle-%");

  const ids = (oldProducts || []).map((product) => product.id);
  if (ids.length === 0) {
    return;
  }

  await productsQuery.delete().in("id", ids);
}

async function setupProduct({ ownerVendorId, buyerUserId }) {
  await deleteOldQaProducts(ownerVendorId);

  const slug = `qa-release-lifecycle-${Date.now()}`;
  const productsQuery = adminSupabase.from("products");
  const versionsQuery = adminSupabase.from("product_versions");
  const filesQuery = adminSupabase.from("product_files");

  const { data: product, error: productError } = await productsQuery
    .insert([
      {
        vendor_id: ownerVendorId,
        title: "QA Release Lifecycle Product",
        slug,
        short_description: "Producto QA para validar el lifecycle de releases.",
        description: "Producto QA para seller/admin/buyer release lifecycle.",
        price_cents: 1900,
        is_free: false,
        moderation_status: "approved",
      },
    ])
    .select("id, vendor_id, title, slug")
    .single();

  if (productError || !product) {
    throw productError || new Error("No se pudo crear el producto QA.");
  }

  const { data: insertedVersions, error: versionError } = await versionsQuery
    .insert([
      {
        product_id: product.id,
        version: "1.0.0",
        changelog: "Historical release QA.",
        release_status: "historical",
        activated_at: new Date("2026-03-15T09:00:00Z").toISOString(),
        created_at: new Date("2026-03-15T09:00:00Z").toISOString(),
      },
      {
        product_id: product.id,
        version: "1.1.0",
        changelog: "Active release QA.",
        release_status: "active",
        activated_at: new Date("2026-03-16T09:00:00Z").toISOString(),
        created_at: new Date("2026-03-16T09:00:00Z").toISOString(),
      },
    ])
    .select("id, version, release_status, created_at");

  if (versionError || !insertedVersions || insertedVersions.length !== 2) {
    throw versionError || new Error("No se pudieron crear las releases base QA.");
  }

  insertedVersions.sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  );

  for (const version of insertedVersions) {
    const fileName = `qa-${version.version}.zip`;
    const filePath = await uploadStorageZip({
      vendorId: product.vendor_id,
      productId: product.id,
      versionId: version.id,
      fileName,
      contents: Buffer.from(`PK-QA-${version.version}`),
    });

    const { error } = await filesQuery.insert([
      {
        product_version_id: version.id,
        storage_path: filePath,
        file_name: fileName,
        file_size_bytes: Buffer.byteLength(`PK-QA-${version.version}`),
      },
    ]);

    if (error) {
      throw error;
    }
  }

  const ordersQuery = adminSupabase.from("orders");
  const orderItemsQuery = adminSupabase.from("order_items");
  const licensesQuery = adminSupabase.from("licenses");

  const { data: order, error: orderError } = await ordersQuery
    .insert([
      {
        user_id: buyerUserId,
        total_cents: 1900,
        currency: "EUR",
        status: "completed",
      },
    ])
    .select("id")
    .single();

  if (orderError || !order) {
    throw orderError || new Error("No se pudo crear el pedido QA.");
  }

  const { data: orderItem, error: orderItemError } = await orderItemsQuery
    .insert([
      {
        order_id: order.id,
        product_id: product.id,
        price_cents: 1900,
      },
    ])
    .select("id")
    .single();

  if (orderItemError || !orderItem) {
    throw orderItemError || new Error("No se pudo crear el order item QA.");
  }

  const { error: licenseError } = await licensesQuery.insert([
    {
      order_item_id: orderItem.id,
      product_id: product.id,
      user_id: buyerUserId,
      license_key: `QA-LIFECYCLE-${Date.now()}`,
      status: "active",
    },
  ]);

  if (licenseError) {
    throw licenseError;
  }

  return {
    product,
    historicalVersionId: insertedVersions[0].id,
    activeVersionId: insertedVersions[1].id,
  };
}

async function getReleaseState(productId) {
  const versionsQuery = adminSupabase.from("product_versions");
  const filesQuery = adminSupabase.from("product_files");

  const { data: versions, error } = await versionsQuery
    .select("id, version, release_status, retired_reason, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const versionIds = (versions || []).map((version) => version.id);
  const { data: files } =
    versionIds.length > 0
      ? await filesQuery.select("id, product_version_id, file_name").in("product_version_id", versionIds)
      : { data: [] };

  return {
    versions: versions || [],
    files: files || [],
  };
}

async function getProductModerationStatus(productId) {
  const { data, error } = await adminSupabase
    .from("products")
    .select("moderation_status")
    .eq("id", productId)
    .single();

  if (error || !data) {
    throw error || new Error("No se pudo leer el estado del producto.");
  }

  return data.moderation_status;
}

async function downloadProduct(cookieHeader, productId) {
  const response = await request(`/api/download/${productId}`, {
    headers: {
      cookie: cookieHeader,
    },
  });

  const payload = await response.json().catch(() => ({}));

  return {
    status: response.status,
    payload,
  };
}

async function postJson(pathname, cookieHeader, body) {
  const response = await request(pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: cookieHeader,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function postRelease(pathname, cookieHeader, version, changelog) {
  const formData = new FormData();
  formData.set("version", version);
  formData.set("changelog", changelog);
  formData.set(
    "file",
    new File([Buffer.from(`PK-QA-${version}`)], `${version}.zip`, {
      type: "application/zip",
    })
  );

  const response = await request(pathname, {
    method: "POST",
    headers: {
      cookie: cookieHeader,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
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
    server = await startServer();

    const ownerUser = await ensureUser({
      email: OWNER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Release Owner",
      username: "qa_release_owner",
    });
    const otherSellerUser = await ensureUser({
      email: OTHER_SELLER_EMAIL,
      password: QA_PASSWORD,
      role: "seller",
      displayName: "QA Release Other Seller",
      username: "qa_release_other",
    });
    const buyerUser = await ensureUser({
      email: BUYER_EMAIL,
      password: QA_PASSWORD,
      role: "buyer",
      displayName: "QA Release Buyer",
      username: "qa_release_buyer",
    });

    const ownerVendor = await ensureVendor(
      ownerUser.id,
      "qa-release-owner-store",
      "QA Release Owner Store"
    );
    await ensureVendor(otherSellerUser.id, "qa-release-other-store", "QA Release Other Store");

    const { product, historicalVersionId, activeVersionId } = await setupProduct({
      ownerVendorId: ownerVendor.id,
      buyerUserId: buyerUser.id,
    });

    const ownerCookie = await login(OWNER_EMAIL, QA_PASSWORD);
    const otherSellerCookie = await login(OTHER_SELLER_EMAIL, QA_PASSWORD);
    const buyerCookie = await login(BUYER_EMAIL, QA_PASSWORD);
    const adminCookie = await login(ADMIN_EMAIL, QA_PASSWORD);

    const anonymousWorkspaceResponse = await request(`/seller/products/${product.id}`);
    recordCase(
      results,
      "anonimo_acceso_workspace_restringido",
      "critical",
      anonymousWorkspaceResponse.status >= 300 &&
        anonymousWorkspaceResponse.status < 400 &&
        (anonymousWorkspaceResponse.headers.get("location") || "").includes("/login"),
      `status=${anonymousWorkspaceResponse.status}, location=${anonymousWorkspaceResponse.headers.get("location")}`,
      "Debe redirigir a /login"
    );

    const ownerWorkspaceResponse = await request(`/seller/products/${product.id}`, {
      headers: { cookie: ownerCookie },
    });
    await ownerWorkspaceResponse.text();
    recordCase(
      results,
      "seller_owner_entra_workspace_propio",
      "critical",
      ownerWorkspaceResponse.status === 200,
      `status=${ownerWorkspaceResponse.status}`,
      "Debe responder 200 para el owner del producto"
    );

    const otherWorkspaceResponse = await request(`/seller/products/${product.id}`, {
      headers: { cookie: otherSellerCookie },
    });
    recordCase(
      results,
      "seller_no_owner_bloqueado_workspace_ajeno",
      "critical",
      otherWorkspaceResponse.status >= 300 &&
        otherWorkspaceResponse.status < 400 &&
        (otherWorkspaceResponse.headers.get("location") || "").includes("/seller"),
      `status=${otherWorkspaceResponse.status}, location=${otherWorkspaceResponse.headers.get("location")}`,
      "Debe redirigir fuera del workspace"
    );

    const buyerWorkspaceResponse = await request(`/seller/products/${product.id}`, {
      headers: { cookie: buyerCookie },
    });
    recordCase(
      results,
      "buyer_bloqueado_en_workspace_seller",
      "critical",
      buyerWorkspaceResponse.status >= 300 &&
        buyerWorkspaceResponse.status < 400 &&
        (buyerWorkspaceResponse.headers.get("location") || "").includes("/seller"),
      `status=${buyerWorkspaceResponse.status}, location=${buyerWorkspaceResponse.headers.get("location")}`,
      "Debe redirigir fuera del workspace seller"
    );

    let releaseState = await getReleaseState(product.id);
    const activeVersions = releaseState.versions.filter((version) => version.release_status === "active");
    const historicalVersions = releaseState.versions.filter(
      (version) => version.release_status === "historical"
    );
    recordCase(
      results,
      "seller_owner_ve_active_e_historical_correctas",
      "critical",
      activeVersions.length === 1 &&
        activeVersions[0].id === activeVersionId &&
        historicalVersions.some((version) => version.id === historicalVersionId),
      `active=${activeVersions.map((version) => version.version).join(",")}; historical=${historicalVersions.map((version) => version.version).join(",")}`,
      "Debe haber una active base y una historical base"
    );

    const initialBuyerDownload = await downloadProduct(buyerCookie, product.id);
    recordCase(
      results,
      "buyer_descarga_con_una_sola_active",
      "critical",
      initialBuyerDownload.status === 200 &&
        String(initialBuyerDownload.payload.url || "").includes(activeVersionId),
      `status=${initialBuyerDownload.status}, url=${initialBuyerDownload.payload.url || null}`,
      "Debe descargar la release active inicial"
    );

    const pendingCreateResponse = await postRelease(
      `/api/seller/products/${product.id}/releases`,
      ownerCookie,
      "1.2.0",
      "Pending QA release"
    );
    recordCase(
      results,
      "seller_owner_sube_nueva_release_y_queda_pending",
      "critical",
      pendingCreateResponse.status === 200 && Boolean(pendingCreateResponse.payload.releaseId),
      `status=${pendingCreateResponse.status}, releaseId=${pendingCreateResponse.payload.releaseId || null}`,
      "Debe crear una pending release"
    );

    const pendingReleaseId = pendingCreateResponse.payload.releaseId || null;
    releaseState = await getReleaseState(product.id);
    const pendingVersionsAfterCreate = releaseState.versions.filter(
      (version) => version.release_status === "pending"
    );
    recordCase(
      results,
      "seller_owner_confirma_active_previa_sigue_vigente_con_pending",
      "critical",
      pendingVersionsAfterCreate.length === 1 &&
        pendingVersionsAfterCreate[0].id === pendingReleaseId &&
        releaseState.versions.some(
          (version) => version.id === activeVersionId && version.release_status === "active"
        ),
      `pending=${pendingVersionsAfterCreate.map((version) => version.version).join(",")}; active=${releaseState.versions.filter((version) => version.release_status === "active").map((version) => version.version).join(",")}`,
      "La pending no debe reemplazar a la active"
    );

    const buyerDownloadWithPending = await downloadProduct(buyerCookie, product.id);
    recordCase(
      results,
      "buyer_sigue_descargando_active_cuando_existe_pending",
      "critical",
      buyerDownloadWithPending.status === 200 &&
        String(buyerDownloadWithPending.payload.url || "").includes(activeVersionId) &&
        !String(buyerDownloadWithPending.payload.url || "").includes(String(pendingReleaseId || "")),
      `status=${buyerDownloadWithPending.status}, url=${buyerDownloadWithPending.payload.url || null}`,
      "Debe seguir descargando la active previa"
    );

    const activateHistoricalResponse = await postJson(
      `/api/seller/products/${product.id}/releases/${historicalVersionId}/status`,
      ownerCookie,
      { action: "activate" }
    );
    releaseState = await getReleaseState(product.id);
    const activeAfterRollback = releaseState.versions.find(
      (version) => version.release_status === "active"
    );
    const previousActiveAfterRollback = releaseState.versions.find(
      (version) => version.id === activeVersionId
    );
    recordCase(
      results,
      "seller_owner_activa_historical_y_hace_rollback_correcto",
      "critical",
      activateHistoricalResponse.status === 200 &&
        activeAfterRollback?.id === historicalVersionId &&
        previousActiveAfterRollback?.release_status === "historical",
      `status=${activateHistoricalResponse.status}, active=${activeAfterRollback?.version || null}, previousActiveState=${previousActiveAfterRollback?.release_status || null}`,
      "La historical debe pasar a active y la active previa a historical"
    );

    const buyerDownloadAfterRollback = await downloadProduct(buyerCookie, product.id);
    recordCase(
      results,
      "buyer_descarga_nueva_active_tras_rollback",
      "critical",
      buyerDownloadAfterRollback.status === 200 &&
        String(buyerDownloadAfterRollback.payload.url || "").includes(historicalVersionId),
      `status=${buyerDownloadAfterRollback.status}, url=${buyerDownloadAfterRollback.payload.url || null}`,
      "El buyer debe descargar la release activada en el rollback"
    );

    const retireHistoricalResponse = await postJson(
      `/api/seller/products/${product.id}/releases/${activeVersionId}/status`,
      ownerCookie,
      { action: "retire", reason: "qa_retire_historical" }
    );
    releaseState = await getReleaseState(product.id);
    const retiredHistorical = releaseState.versions.find((version) => version.id === activeVersionId);
    recordCase(
      results,
      "seller_owner_retirar_historical_funciona",
      "high",
      retireHistoricalResponse.status === 200 &&
        retiredHistorical?.release_status === "retired" &&
        retiredHistorical?.retired_reason === "qa_retire_historical",
      `status=${retireHistoricalResponse.status}, retiredState=${retiredHistorical?.release_status || null}, reason=${retiredHistorical?.retired_reason || null}`,
      "La historical retirada debe pasar a retired"
    );

    const retirePendingResponse = await postJson(
      `/api/seller/products/${product.id}/releases/${pendingReleaseId}/status`,
      ownerCookie,
      { action: "retire", reason: "qa_retire_pending" }
    );
    releaseState = await getReleaseState(product.id);
    const retiredPending = releaseState.versions.find((version) => version.id === pendingReleaseId);
    recordCase(
      results,
      "seller_owner_retirar_pending_funciona",
      "high",
      retirePendingResponse.status === 200 &&
        retiredPending?.release_status === "retired" &&
        retiredPending?.retired_reason === "qa_retire_pending",
      `status=${retirePendingResponse.status}, pendingState=${retiredPending?.release_status || null}, reason=${retiredPending?.retired_reason || null}`,
      "La pending retirada debe pasar a retired"
    );

    const retireActiveBlockedResponse = await postJson(
      `/api/seller/products/${product.id}/releases/${historicalVersionId}/status`,
      ownerCookie,
      { action: "retire", reason: "qa_should_block_active" }
    );
    releaseState = await getReleaseState(product.id);
    const activeAfterBlockedRetire = releaseState.versions.find((version) => version.id === historicalVersionId);
    recordCase(
      results,
      "seller_owner_no_puede_retirar_active",
      "critical",
      retireActiveBlockedResponse.status === 409 &&
        activeAfterBlockedRetire?.release_status === "active",
      `status=${retireActiveBlockedResponse.status}, activeState=${activeAfterBlockedRetire?.release_status || null}, message=${retireActiveBlockedResponse.payload.message || null}`,
      "La active debe seguir bloqueada para retiro directo"
    );

    const createPendingForApprove = await postRelease(
      `/api/seller/products/${product.id}/releases`,
      ownerCookie,
      "1.3.0",
      "Pending release to approve"
    );
    const pendingForApproveId = createPendingForApprove.payload.releaseId || null;
    const adminApproveResponse = await postJson(
      `/api/admin/products/${product.id}/moderate`,
      adminCookie,
      { action: "approve" }
    );
    releaseState = await getReleaseState(product.id);
    const approvedPending = releaseState.versions.find((version) => version.id === pendingForApproveId);
    const historicalAfterApprove = releaseState.versions.find((version) => version.id === historicalVersionId);
    recordCase(
      results,
      "admin_aprueba_pending_y_la_convierte_en_active",
      "critical",
      createPendingForApprove.status === 200 &&
        adminApproveResponse.status === 200 &&
        approvedPending?.release_status === "active" &&
        historicalAfterApprove?.release_status === "historical",
      `createStatus=${createPendingForApprove.status}, approveStatus=${adminApproveResponse.status}, approvedPendingState=${approvedPending?.release_status || null}, previousActiveState=${historicalAfterApprove?.release_status || null}`,
      "La pending aprobada debe pasar a active y la active previa a historical"
    );

    const buyerDownloadAfterApprove = await downloadProduct(buyerCookie, product.id);
    recordCase(
      results,
      "buyer_descarga_nueva_active_tras_aprobacion_admin",
      "critical",
      buyerDownloadAfterApprove.status === 200 &&
        String(buyerDownloadAfterApprove.payload.url || "").includes(String(pendingForApproveId || "")),
      `status=${buyerDownloadAfterApprove.status}, url=${buyerDownloadAfterApprove.payload.url || null}`,
      "El buyer debe descargar la active aprobada"
    );

    const createPendingForReject = await postRelease(
      `/api/seller/products/${product.id}/releases`,
      ownerCookie,
      "1.4.0",
      "Pending release to reject"
    );
    const pendingForRejectId = createPendingForReject.payload.releaseId || null;
    const adminRejectResponse = await postJson(
      `/api/admin/products/${product.id}/moderate`,
      adminCookie,
      { action: "reject", reason: "qa_reject_pending" }
    );
    releaseState = await getReleaseState(product.id);
    const rejectedPending = releaseState.versions.find((version) => version.id === pendingForRejectId);
    const currentActiveAfterReject = releaseState.versions.find(
      (version) => version.release_status === "active"
    );
    const productModerationStatus = await getProductModerationStatus(product.id);
    recordCase(
      results,
      "admin_rechaza_pending_y_la_convierte_en_retired_sin_romper_release_viva",
      "critical",
      createPendingForReject.status === 200 &&
        adminRejectResponse.status === 200 &&
        rejectedPending?.release_status === "retired" &&
        currentActiveAfterReject?.id === pendingForApproveId &&
        productModerationStatus === "approved",
      `createStatus=${createPendingForReject.status}, rejectStatus=${adminRejectResponse.status}, rejectedState=${rejectedPending?.release_status || null}, currentActive=${currentActiveAfterReject?.version || null}, productStatus=${productModerationStatus}`,
      "La pending rechazada debe pasar a retired y el producto seguir aprobado con su active intacta"
    );

    const failed = results.filter((test) => test.status === "FAIL");
    const summary = {
      executedAt: new Date().toISOString(),
      productId: product.id,
      productSlug: product.slug,
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      results,
    };

    console.log(JSON.stringify(summary, null, 2));

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  const serializedError =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : typeof error === "object" && error !== null
        ? JSON.parse(JSON.stringify(error))
        : { message: String(error) };

  console.error(
    JSON.stringify(
      {
        fatal: true,
        error: serializedError,
      },
      null,
      2
    )
  );
  process.exit(1);
});
