import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

interface RecordAuditLogInput {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Json;
}

export async function recordAuditLog({
  actorUserId = null,
  action,
  entityType,
  entityId,
  metadata = null,
}: RecordAuditLogInput) {
  const adminSupabase = createAdminClient();
  const auditLogs = adminSupabase.from("audit_logs") as any;

  const { error } = await auditLogs.insert([
    {
      actor_user_id: actorUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    },
  ]);

  return { error };
}
