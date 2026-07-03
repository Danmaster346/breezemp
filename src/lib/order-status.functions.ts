// Серверная функция: продавец меняет статус своей позиции в заказе
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Валидация входных данных
const schema = z.object({
  order_item_id: z.string().uuid(),
  status: z.enum([
    "new",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ]),
});

// Обновление статуса позиции заказа
export const updateOrderItemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Загружаем сервис-роль клиента, чтобы обновление не блокировалось RLS
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Проверяем, что этот order_item принадлежит текущему продавцу
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from("order_items")
      .select("id, seller_id")
      .eq("id", data.order_item_id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!item) throw new Error("Позиция не найдена");
    if (item.seller_id !== userId) throw new Error("Нет доступа к этой позиции");
    // Применяем новый статус
    const { error: updErr } = await supabaseAdmin
      .from("order_items")
      .update({ status: data.status })
      .eq("id", data.order_item_id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });
