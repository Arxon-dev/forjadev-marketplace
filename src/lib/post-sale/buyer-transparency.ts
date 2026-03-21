import { buildRefundResolutionSnapshot } from "@/lib/refunds/post-sale";

type LicenseStatus = "active" | "revoked";
type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";
type DisputeStatus = "open" | "reviewing" | "resolved" | "rejected";

interface BuyerPostSaleTransparencyInput {
  orderStatus?: string | null;
  accessOk?: boolean;
  accessMessage?: string | null;
  licenseStatus?: LicenseStatus | null;
  hasDownload?: boolean;
  supportStatuses?: SupportTicketStatus[];
  disputeStatuses?: DisputeStatus[];
  productRefundPolicy?: string | null;
}

export interface BuyerPostSaleTransparencySnapshot {
  stage:
    | "download_ready"
    | "redownload_ready"
    | "support_waiting_seller"
    | "support_waiting_buyer"
    | "support_open"
    | "dispute_open"
    | "dispute_reviewing"
    | "refunded"
    | "rejected"
    | "resolved_without_refund"
    | "blocked_revoked"
    | "release_pending"
    | "ownership_recorded";
  label: string;
  summary: string;
  nextAction: string;
  expectation: string;
  policyHint: string;
  tone: string;
}

function defaultPolicyHint(productRefundPolicy?: string | null) {
  return productRefundPolicy?.trim()
    ? `Policy visible: ${productRefundPolicy.trim()}`
    : "La resolucion final depende del pedido, del acceso real, del intercambio de soporte y de la policy general de reembolsos.";
}

export function buildBuyerPostSaleTransparencySnapshot({
  orderStatus = null,
  accessOk = false,
  accessMessage = null,
  licenseStatus = null,
  hasDownload = false,
  supportStatuses = [],
  disputeStatuses = [],
  productRefundPolicy = null,
}: BuyerPostSaleTransparencyInput): BuyerPostSaleTransparencySnapshot {
  const refundSnapshot = buildRefundResolutionSnapshot({
    orderStatus,
    licenseStatus,
    supportStatuses,
    disputeStatuses,
    productRefundPolicy,
  });

  if (orderStatus === "refunded") {
    return {
      stage: "refunded",
      label: "Pedido reembolsado",
      summary:
        "La compra ya figura como reembolsada y ese producto permanece en tu historico postventa, pero sin acceso comercial activo.",
      nextAction: "Revisa el cierre del caso y conserva el contexto del pedido si necesitas seguimiento adicional.",
      expectation:
        "La descarga deja de estar disponible y la licencia vinculada queda revocada como parte del cierre del reembolso.",
      policyHint: refundSnapshot.policyHint,
      tone: refundSnapshot.tone,
    };
  }

  if (disputeStatuses.includes("reviewing")) {
    return {
      stage: "dispute_reviewing",
      label: "Caso en revision administrativa",
      summary:
        "El marketplace ya esta revisando el caso con el contexto de pedido, licencia y soporte para decidir la resolucion final.",
      nextAction:
        "Sigue la disputa y responde si el equipo solicita evidencia adicional o alguna aclaracion del caso.",
      expectation:
        "Mientras la revision siga abierta, el resultado economico y el acceso final pueden cambiar segun la resolucion.",
      policyHint: refundSnapshot.policyHint,
      tone: refundSnapshot.tone,
    };
  }

  if (disputeStatuses.includes("open")) {
    return {
      stage: "dispute_open",
      label: "Disputa abierta",
      summary:
        "El caso ya salio del soporte normal y ha entrado en la via administrativa del marketplace.",
      nextAction: "Mantente pendiente de la disputa y revisa el ticket relacionado por si necesitas ampliar contexto.",
      expectation:
        "El siguiente paso razonable es que el marketplace revise el expediente y defina si procede una resolucion adicional.",
      policyHint: refundSnapshot.policyHint,
      tone: refundSnapshot.tone,
    };
  }

  if (disputeStatuses.includes("rejected")) {
    return {
      stage: "rejected",
      label: "Revision cerrada sin reembolso",
      summary:
        "La disputa ya fue cerrada y el marketplace no concedio reembolso con la evidencia disponible en ese momento.",
      nextAction:
        "Si el problema persiste o aparece evidencia nueva, vuelve a soporte con el pedido y el contexto actualizado.",
      expectation:
        "El acceso y la licencia siguen regidos por el estado actual del pedido y por la resolucion ya emitida.",
      policyHint: refundSnapshot.policyHint,
      tone: refundSnapshot.tone,
    };
  }

  if (disputeStatuses.includes("resolved")) {
    return {
      stage: "resolved_without_refund",
      label: "Caso administrativo resuelto",
      summary:
        "La disputa ya tiene una resolucion registrada y el caso no aparece como pendiente de nueva revision.",
      nextAction:
        "Revisa el pedido, la licencia y el ticket relacionado para confirmar si necesitas alguna accion adicional.",
      expectation:
        "Si no hubo reembolso visible, el resultado final no se tradujo en una devolucion economica registrada.",
      policyHint: refundSnapshot.policyHint,
      tone: refundSnapshot.tone,
    };
  }

  if (supportStatuses.includes("waiting_buyer")) {
    return {
      stage: "support_waiting_buyer",
      label: "Tu respuesta desbloquea el caso",
      summary:
        "El soporte sigue abierto, pero ahora mismo necesita una respuesta por tu parte para seguir avanzando.",
      nextAction: "Responde al ticket con el contexto pendiente para evitar que el caso se enfrie o quede bloqueado.",
      expectation:
        "Una vez respondas, el seller o el marketplace podran continuar la revision normal del problema.",
      policyHint: defaultPolicyHint(productRefundPolicy),
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    };
  }

  if (supportStatuses.includes("waiting_seller")) {
    return {
      stage: "support_waiting_seller",
      label: "El seller debe responder ahora",
      summary:
        "El caso sigue en soporte normal y el siguiente movimiento razonable corresponde al seller.",
      nextAction:
        "Sigue el ticket y escala solo si no aparece una solucion razonable o el caso deja de avanzar.",
      expectation:
        "Antes de una disputa, el marketplace espera que soporte tenga margen para proponer una solucion normal.",
      policyHint: defaultPolicyHint(productRefundPolicy),
      tone: "border-sky-500/30 bg-sky-500/10 text-sky-200",
    };
  }

  if (supportStatuses.includes("open")) {
    return {
      stage: "support_open",
      label: "Caso abierto en soporte",
      summary:
        "Ya existe una incidencia abierta y el flujo activo sigue siendo la resolucion por soporte antes de cualquier escalado.",
      nextAction: "Revisa el ticket y aporta el contexto necesario para que el caso siga moviendose.",
      expectation:
        "Si soporte no resuelve el problema de forma razonable, el siguiente paso podra ser el escalado administrativo.",
      policyHint: defaultPolicyHint(productRefundPolicy),
      tone: "border-white/10 bg-white/5 text-[var(--text-soft)]",
    };
  }

  if (!accessOk && accessMessage?.includes("revocada")) {
    return {
      stage: "blocked_revoked",
      label: "Acceso bloqueado por licencia revocada",
      summary:
        "La compra sigue formando parte de tu historico, pero el acceso normal esta bloqueado porque la licencia ya no esta activa.",
      nextAction:
        "Revisa el pedido y, si no reconoces el bloqueo o falta contexto, abre soporte antes de un escalado.",
      expectation:
        "Mientras la licencia siga revocada, la descarga no volvera a estar disponible como acceso comercial activo.",
      policyHint: defaultPolicyHint(productRefundPolicy),
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    };
  }

  if (!accessOk && accessMessage?.includes("release activa")) {
    return {
      stage: "release_pending",
      label: "Compra registrada, acceso pendiente",
      summary:
        "Tu ownership ya existe, pero ahora mismo no hay una release activa que permita descargar el producto con normalidad.",
      nextAction:
        "Revisa el pedido y abre soporte si necesitas confirmar cuando vuelve a estar disponible el acceso.",
      expectation:
        "El acceso se normaliza cuando el producto vuelve a tener una release activa o soporte aclara el bloqueo.",
      policyHint: defaultPolicyHint(productRefundPolicy),
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    };
  }

  if (accessOk && hasDownload) {
    return {
      stage: "redownload_ready",
      label: "Acceso confirmado para redescarga",
      summary:
        "Tu compra sigue vigente y este producto ya forma parte de tu biblioteca operativa con redescarga disponible.",
      nextAction: "Usa la redescarga cuando la necesites y abre soporte solo si algo deja de coincidir con tu acceso.",
      expectation:
        "Mientras la licencia y la release activa sigan vigentes, el producto debe seguir disponible desde tu biblioteca.",
      policyHint: defaultPolicyHint(productRefundPolicy),
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    };
  }

  if (accessOk) {
    return {
      stage: "download_ready",
      label: "Descarga disponible",
      summary:
        "La compra esta en buen estado operativo y ya puedes descargar el producto con normalidad.",
      nextAction:
        "Descarga el producto y vuelve a esta superficie si necesitas soporte, licencia o seguimiento postventa.",
      expectation:
        "Si el acceso sigue vigente, este mismo producto aparecera tambien como disponible desde biblioteca y pedidos.",
      policyHint: defaultPolicyHint(productRefundPolicy),
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    };
  }

  return {
    stage: "ownership_recorded",
    label: "Compra registrada en seguimiento",
    summary:
      "La compra existe y el producto sigue dentro de tu recorrido postventa, aunque el estado actual requiere mas contexto para confirmar acceso normal.",
    nextAction: "Revisa pedido, licencia y soporte para ver donde esta exactamente el bloqueo o la revision.",
    expectation:
      "Las superficies de pedidos, biblioteca, soporte y disputas deben darte el mismo contexto operativo del caso.",
    policyHint: defaultPolicyHint(productRefundPolicy),
    tone: "border-white/10 bg-white/5 text-[var(--text-soft)]",
  };
}
