// Серверные функции: переходы по статусам заказа (WB-модель)
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();

// Список статусов, из которых продавец может «отправить»
const PROCESSING_SET = new Set(["new", "confirmed", "processing"]);

// Продавец: перевести позицию в «Отправлен» с трек-номером и службой доставки
export const sellerShipOrderItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        order_item_id: uuid,
        tracking_number: z
          .string()
          .trim()
          .min(3, "Трек-номер слишком короткий")
          .max(80, "Трек-номер слишком длинный"),
        shipping_carrier: z.string().trim().min(2).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from("order_items")
      .select("id, seller_id, status")
      .eq("id", data.order_item_id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!item) throw new Error("Позиция не найдена");
    if (item.seller_id !== context.userId) throw new Error("Нет доступа к этой позиции");
    if (!PROCESSING_SET.has(item.status ?? "processing"))
      throw new Error("Отправить можно только со статуса «На сборке»");

    const { error } = await supabaseAdmin
      .from("order_items")
      .update({
        status: "shipped",
        tracking_number: data.tracking_number,
        shipping_carrier: data.shipping_carrier,
        shipped_at: new Date().toISOString(),
      })
      .eq("id", data.order_item_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Продавец: отменить позицию (только до отправки)
export const sellerCancelOrderItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ order_item_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from("order_items")
      .select("id, seller_id, status")
      .eq("id", data.order_item_id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!item) throw new Error("Позиция не найдена");
    if (item.seller_id !== context.userId) throw new Error("Нет доступа");
    if (!PROCESSING_SET.has(item.status ?? "processing"))
      throw new Error("Отменить можно только со статуса «На сборке»");
    const { error } = await supabaseAdmin
      .from("order_items")
      .update({ status: "cancelled" })
      .eq("id", data.order_item_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Покупатель: подтвердить получение (только после «Отправлен»)
export const buyerConfirmReceivedItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ order_item_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from("order_items")
      .select("id, status, orders!inner(buyer_id)")
      .eq("id", data.order_item_id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!item) throw new Error("Позиция не найдена");
    const buyerId = (item as unknown as { orders: { buyer_id: string } }).orders.buyer_id;
    if (buyerId !== context.userId) throw new Error("Нет доступа");
    if (item.status !== "shipped" && item.status !== "delivered")
      throw new Error("Подтвердить можно только отправленный заказ");
    const { error } = await supabaseAdmin
      .from("order_items")
      .update({ status: "received", received_at: new Date().toISOString() })
      .eq("id", data.order_item_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Покупатель: оформить возврат (после «Отправлен» или «Получено»)
export const buyerReturnOrderItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        order_item_id: uuid,
        reason: z.string().trim().min(2).max(120),
        comment: z.string().trim().max(1000).optional().default(""),
        photos: z.array(z.string().url()).max(5).optional().default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from("order_items")
      .select("id, status, orders!inner(buyer_id)")
      .eq("id", data.order_item_id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!item) throw new Error("Позиция не найдена");
    const buyerId = (item as unknown as { orders: { buyer_id: string } }).orders.buyer_id;
    if (buyerId !== context.userId) throw new Error("Нет доступа");
    if (
      item.status !== "shipped" &&
      item.status !== "delivered" &&
      item.status !== "received"
    )
      throw new Error("Возврат доступен только после отправки заказа");
    // Заявка на возврат уходит в модерацию (status='return_requested').
    // Реальный возврат оформит администратор через resolveReturn.
    const { error } = await supabaseAdmin
      .from("order_items")
      .update({
        status: "return_requested",
        return_admin_status: "pending",
        return_reason: data.reason,
        return_comment: data.comment,
        return_photos: data.photos,
        returned_at: new Date().toISOString(),
      })
      .eq("id", data.order_item_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
