import type { DisputeStatus, SupportTicketStatus } from "@/lib/disputes/detail";
import type { GuardrailSeverity } from "@/lib/risk/post-sale-guardrails";

export type AdminDisputeTriagePriority = "low" | "medium" | "high";

interface AdminDisputeTriageInput {
  disputeStatus: DisputeStatus;
  guardrailSeverity: GuardrailSeverity | null;
  latestSupportStatus?: SupportTicketStatus | null;
  updatedAt: string;
}

export interface AdminDisputeTriageSnapshot {
  priority: AdminDisputeTriagePriority;
  label: string;
  tone: string;
  score: number;
  reason: string;
}

function guardrailScore(severity: GuardrailSeverity | null) {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
}

function ageScore(updatedAt: string) {
  const ageHours = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60);
  if (ageHours >= 72) return 2;
  if (ageHours >= 24) return 1;
  return 0;
}

export function adminDisputePriorityTone(priority: AdminDisputeTriagePriority) {
  if (priority === "high") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  }

  if (priority === "medium") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return "border-sky-500/30 bg-sky-500/10 text-sky-200";
}

export function buildAdminDisputeTriageSnapshot({
  disputeStatus,
  guardrailSeverity,
  latestSupportStatus = null,
  updatedAt,
}: AdminDisputeTriageInput): AdminDisputeTriageSnapshot {
  let score = 0;
  const reasons: string[] = [];

  if (disputeStatus === "reviewing") {
    score += 3;
    reasons.push("caso ya en revision");
  } else if (disputeStatus === "open") {
    score += 2;
    reasons.push("caso aun sin resolver");
  }

  const guardrailWeight = guardrailScore(guardrailSeverity);
  if (guardrailWeight > 0) {
    score += guardrailWeight;
    reasons.push(`guardrails ${guardrailSeverity}`);
  }

  if (latestSupportStatus === "waiting_seller") {
    score += 1;
    reasons.push("soporte esperando seller");
  } else if (latestSupportStatus === "waiting_buyer") {
    score -= 1;
    reasons.push("soporte esperando buyer");
  }

  const urgencyAge = ageScore(updatedAt);
  if (urgencyAge > 0) {
    score += urgencyAge;
    reasons.push(urgencyAge > 1 ? "lleva dias sin cierre" : "lleva tiempo abierto");
  }

  const priority: AdminDisputeTriagePriority = score >= 6 ? "high" : score >= 3 ? "medium" : "low";
  const label =
    priority === "high"
      ? "Prioridad alta"
      : priority === "medium"
        ? "Prioridad media"
        : "Prioridad baja";

  return {
    priority,
    label,
    tone: adminDisputePriorityTone(priority),
    score,
    reason:
      reasons.length > 0
        ? `Se prioriza por ${reasons.join(", ")}.`
        : "Caso sin senales de urgencia adicionales.",
  };
}
