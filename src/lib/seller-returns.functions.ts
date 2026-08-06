// Серверные функции: продавец видит и решает по возвратам своих товаров
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();

// Список заявок на возврат для продавца.
// filter: pending — новые (ждут решения), resolved — уже решённые, all — все
export const listSellerReturns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        filter: z.enum(["pending", "resolved", "all"]).optional().default("pending"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("order_items")
      .select(
        "id, order_id, seller_id, product_id, title_snapshot, image_url, price_kopecks, quantity, status, return_reason, return_comment, return_photos, return_admin_status, return_admin_reason, returned_at, tracking_number, shipping_carrier, orders(id, buyer_id, created_at, shipping_name, shipping_phone, shipping_address)",
      )
      .eq("seller_id", context.userId)
      .in("status", ["return_requested", "returned"]);

    if (data.filter === "pending") {
      q = q.in("return_admin_status", ["none", "pending"]).eq("status", "return_requested");
    } else if (data.filter === "resolved") {
      q = q.in("return_admin_status", ["approved", "rejected"]);
    }

    const { data: rows, error } = await q.order("returned_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Продавец принимает решение по возврату: approve — вернуть, reject — отклонить
export const sellerResolveReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        order_item_id: uuid,
        action: z.enum(["approve", "reject"]),
        comment: z.string().trim().max(1000).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item, error: fetchErr } = await supabaseAdmin
      .from("order_items")
      .select("id, seller_id, product_id, order_id, status, title_snapshot")
      .eq("id", data.order_item_id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!item) throw new Error("Позиция не найдена");
    if (item.seller_id !== context.userId) throw new Error("Нет доступа");
    if (item.status !== "return_requested")
      throw new Error("Заявка уже обработана");

    if (data.action === "reject" && !data.comment.trim()) {
      throw new Error("Для отказа необходимо указать причину");
    }

    if (data.action === "approve") {
      const { error } = await supabaseAdmin
        .from("order_items")
        .update({
          status: "returned",
          return_admin_status: "approved",
          return_admin_reason: data.comment || null,
          returned_at: new Date().toISOString(),
        })
        .eq("id", data.order_item_id);
      if (error) throw new Error(error.message);
    } else {
      // При отклонении возвращаем статус в «Отправлен» — покупатель видит отказ
      const { error } = await supabaseAdmin
        .from("order_items")
        .update({
          status: "shipped",
          return_admin_status: "rejected",
          return_admin_reason: data.comment,
        })
        .eq("id", data.order_item_id);
      if (error) throw new Error(error.message);
    }

    // Системное сообщение в диалог покупатель — продавец
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("buyer_id")
      .eq("id", item.order_id)
      .maybeSingle();
    if (order) {
      const { postSystemMessage } = await import("@/lib/messaging/system.server");
      const label =
        data.action === "approve"
          ? `Возврат одобрен по позиции «${item.title_snapshot}».`
          : `Возврат отклонён по позиции «${item.title_snapshot}».`;
      await postSystemMessage({
        buyerId: order.buyer_id,
        sellerId: item.seller_id,
        senderId: context.userId,
        orderId: item.order_id,
        body: data.comment ? `${label}\nКомментарий: ${data.comment}` : label,
      });
    }

    return { ok: true };
  });
