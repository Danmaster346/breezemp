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
    "received",
    "returned",
    "cancelled",
  ]),
});

// Обновление статуса позиции заказа
export const updateOrderItemStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from("order_items")
      .select("id, seller_id, status, orders!inner(buyer_id)")
      .eq("id", data.order_item_id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!item) throw new Error("Позиция не найдена");
    const buyerId = (item as unknown as { orders: { buyer_id: string } }).orders.buyer_id;
    const isSeller = item.seller_id === userId;
    const isBuyer = buyerId === userId;
    if (!isSeller && !isBuyer) throw new Error("Нет доступа к этой позиции");
    // Покупатель может только подтвердить получение (delivered → received)
    if (!isSeller && isBuyer) {
      if (!(item.status === "delivered" && data.status === "received")) {
        throw new Error("Покупатель может только подтвердить получение");
      }
    }
    const { error: updErr } = await supabaseAdmin
      .from("order_items")
      .update({ status: data.status })
      .eq("id", data.order_item_id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });
