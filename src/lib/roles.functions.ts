// Серверные функции для управления ролями пользователей
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Назначение роли "продавец" текущему аутентифицированному пользователю.
// Роль назначается через сервисный клиент, минуя RLS,
// поэтому обычные пользователи не могут вручную выдать себе роль "seller".
export const becomeSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Загружаем админский клиент только в теле обработчика
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // upsert по (user_id, role), чтобы повторный вызов не давал ошибку
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "seller" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
