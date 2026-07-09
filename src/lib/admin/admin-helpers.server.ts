// Общие серверные хелперы для админ-панели.
// Импортируется ТОЛЬКО динамически внутри handler'ов server functions.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Проверяет, что userId имеет роль 'admin'. Кидает 403 при отсутствии.
export async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

// Запись в журнал действий администратора
export async function logAction(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
) {
  await supabaseAdmin.from("admin_logs").insert({
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
}

export { supabaseAdmin };
