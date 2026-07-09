import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAdminReturns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; page?: number; pageSize?: number }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const page = data.page ?? 1;
    const size = Math.min(data.pageSize ?? 30, 100);
    const from = (page - 1) * size;

    let q = supabaseAdmin
      .from("order_items")
      .select("id, order_id, seller_id, title_snapshot, image_url, price_kopecks, quantity, status, return_reason, return_comment, return_photos, return_admin_status, return_admin_reason, orders(id, buyer_id, created_at)", { count: "exact" });
    q = q.in("status", ["return_requested", "returned"]);
    if (data.status === "pending") q = q.eq("return_admin_status", "none");
    if (data.status === "approved") q = q.eq("return_admin_status", "approved");
    if (data.status === "rejected") q = q.eq("return_admin_status", "rejected");

    const { data: rows, error, count } = await q.order("id", { ascending: false }).range(from, from + size - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page, pageSize: size };
  });

export const resolveReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { itemId: string; action: "approve" | "reject" | "request_info"; reason?: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    if (data.action === "approve") {
      const { error } = await supabaseAdmin
        .from("order_items")
        .update({ return_admin_status: "approved", status: "returned", return_admin_reason: data.reason ?? null, returned_at: new Date().toISOString() })
        .eq("id", data.itemId);
      if (error) throw new Error(error.message);
    } else if (data.action === "reject") {
      const { error } = await supabaseAdmin
        .from("order_items")
        .update({ return_admin_status: "rejected", return_admin_reason: data.reason ?? null })
        .eq("id", data.itemId);
      if (error) throw new Error(error.message);
    } else {
      // request_info — оставляем статус, ставим note в chat при наличии
      const { data: item } = await supabaseAdmin.from("order_items").select("order_id, seller_id, product_id").eq("id", data.itemId).maybeSingle();
      const { data: order } = item ? await supabaseAdmin.from("orders").select("buyer_id").eq("id", item.order_id).maybeSingle() : { data: null };
      if (item && order) {
        const { data: chat } = await supabaseAdmin
          .from("chats")
          .upsert(
            { buyer_id: order.buyer_id, seller_id: item.seller_id, product_id: item.product_id, order_id: item.order_id },
            { onConflict: "buyer_id,seller_id,product_id,order_id", ignoreDuplicates: false },
          )
          .select("id")
          .maybeSingle();
        if (chat) {
          await supabaseAdmin.from("chat_messages").insert({
            chat_id: chat.id,
            sender_id: context.userId,
            body: `Администратор запрашивает дополнительную информацию по возврату: ${data.reason ?? "уточните детали"}`,
          });
        }
      }
    }
    await logAction(context.userId, `return.${data.action}`, "order_item", data.itemId, { reason: data.reason });
    return { ok: true };
  });
