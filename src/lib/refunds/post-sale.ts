type LicenseStatus = "active" | "revoked";
type SupportTicketStatus = "open" | "waiting_seller" | "waiting_buyer" | "closed";
type DisputeStatus = "open" | "reviewing" | "resolved" | "rejected";

interface RefundResolutionInput {
  orderStatus: string | null | undefined;
  licenseStatus?: LicenseStatus | null;
  supportStatuses?: SupportTicketStatus[];
  disputeStatuses?: DisputeStatus[];
  productRefundPolicy?: string | null;
}

export interface RefundResolutionSnapshot {
  stage:
    | "refunded"
    | "reviewing"
    | "rejected"
    | "resolved_without_refund"
    | "support_first"
    | "access_issue"
    | "eligible";
  label: string;
  summary: string;
  nextAction: string;
  tone: string;
  policyHint: string;
}

export function buildRefundResolutionSnapshot({
  orderStatus,
  licenseStatus = null,
  supportStatuses = [],
  disputeStatuses = [],
  productRefundPolicy,
}: RefundResolutionInput): RefundResolutionSnapshot {
  const policyHint = productRefundPolicy?.trim()
    ? `Policy del producto: ${productRefundPolicy.trim()}`
    : "La decision final depende del pedido, del acceso real, del intercambio de soporte y de la policy general de reembolsos.";

  if (orderStatus === "refunded") {
    return {
      stage: "refunded",
      label: "Reembolso emitido",
      summary:
        "Este pedido ya figura como reembolsado. El acceso comercial de esta compra deja de estar vigente y la licencia asociada queda revocada.",
      nextAction:
        "Revisa el pedido, la licencia y cualquier mensaje pendiente del marketplace para confirmar el cierre del caso.",
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      policyHint,
    };
  }

  if (disputeStatuses.includes("reviewing") || disputeStatuses.includes("open")) {
    return {
      stage: "reviewing",
      label: "Reembolso en revision",
      summary: disputeStatuses.includes("reviewing")
        ? "El marketplace ya esta revisando si corresponde una resolucion postventa y posible reembolso."
        : "La disputa ya esta abierta y pendiente de revision administrativa.",
      nextAction:
        "Sigue la disputa y conserva el contexto del pedido, la licencia y el soporte por si se solicita evidencia adicional.",
      tone: "border-sky-500/30 bg-sky-500/10 text-sky-200",
      policyHint,
    };
  }

  if (disputeStatuses.includes("rejected")) {
    return {
      stage: "rejected",
      label: "Reembolso rechazado",
      summary:
        "La revision administrativa cerro el caso sin conceder reembolso. El marketplace no considera que haya base suficiente para devolver el pedido en este estado.",
      nextAction:
        "Si aparece nueva evidencia o el problema persiste, vuelve a soporte con el contexto actualizado antes de intentar un nuevo escalado.",
      tone: "border-rose-500/30 bg-rose-500/10 text-rose-200",
      policyHint,
    };
  }

  if (disputeStatuses.includes("resolved")) {
    return {
      stage: "resolved_without_refund",
      label: "Caso resuelto sin reembolso visible",
      summary:
        "La disputa ya fue resuelta, pero el pedido no figura como reembolsado. La resolucion final no se tradujo en una devolucion economica visible.",
      nextAction:
        "Revisa el resultado del caso y, si sigues necesitando ayuda, vuelve a soporte con los datos del pedido y la licencia.",
      tone: "border-white/10 bg-white/5 text-[var(--text-soft)]",
      policyHint,
    };
  }

  const openSupportStatus = supportStatuses.find((status) => status !== "closed");
  if (openSupportStatus) {
    const supportSummary =
      openSupportStatus === "waiting_buyer"
        ? "Tu ticket necesita respuesta por tu parte antes de escalar."
        : openSupportStatus === "waiting_seller"
          ? "El seller todavia tiene margen razonable para responder y proponer solucion."
          : "El caso sigue abierto por soporte normal antes de pasar a una revision administrativa.";

    return {
      stage: "support_first",
      label: "Primero pasa por soporte",
      summary: `${supportSummary} El reembolso no se decide de forma aislada: primero se evalua si existe una solucion razonable.`,
      nextAction:
        openSupportStatus === "waiting_buyer"
          ? "Responde al ticket para mantener el caso en movimiento."
          : "Sigue el ticket y escala solo si no aparece una solucion razonable.",
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-200",
      policyHint,
    };
  }

  if (licenseStatus === "revoked") {
    return {
      stage: "access_issue",
      label: "Bloqueo de acceso que requiere revision",
      summary:
        "La licencia esta revocada y el acceso de la compra ya no es normal. Si no reconoces este bloqueo o no hubo solucion razonable, el caso debe revisarse por soporte y puede terminar en reembolso.",
      nextAction:
        "Abre soporte con el pedido y la licencia para validar el bloqueo antes de una disputa.",
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-200",
      policyHint,
    };
  }

  return {
    stage: "eligible",
    label: "Revision postventa disponible",
    summary:
      "La compra esta completada, pero cualquier reembolso depende de si el producto incumple lo prometido y de si soporte ofrece o no una solucion razonable.",
    nextAction:
      "Revisa la policy aplicable y abre soporte si necesitas iniciar una revision formal del caso.",
    tone: "border-white/10 bg-white/5 text-[var(--text-soft)]",
    policyHint,
  };
}
