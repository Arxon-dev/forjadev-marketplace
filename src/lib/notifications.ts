import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

interface CreateUserNotificationInput {
  recipientUserId: string;
  actorUserId?: string | null;
  kind: string;
  title: string;
  body: string;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Json;
}

export async function createUserNotification({
  recipientUserId,
  actorUserId = null,
  kind,
  title,
  body,
  href = null,
  entityType = null,
  entityId = null,
  metadata = null,
}: CreateUserNotificationInput) {
  const adminSupabase = createAdminClient();
  const notifications = adminSupabase.from("user_notifications") as any;

  const { error } = await notifications.insert([
    {
      recipient_user_id: recipientUserId,
      actor_user_id: actorUserId,
      kind,
      title,
      body,
      href,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    },
  ]);

  return { error };
}
