import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAdminOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string; status?: string; page?: number; pageSize?: number }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const page = data.page ?? 1;
    const size = Math.min(data.pageSize ?? 30, 100);
    const from = (page - 1) * size;

    let q = supabaseAdmin
      .from("orders")
      .select("id, buyer_id, status, total_kopecks, commission_kopecks, shipping_name, shipping_phone, shipping_address, created_at, order_items(id, seller_id, title_snapshot, price_kopecks, quantity, status)", { count: "exact" });
    if (data.q) q = q.ilike("id", `%${data.q.trim()}%`);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);

    const { data: rows, error, count } = await q.order("created_at", { ascending: false }).range(from, from + size - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page, pageSize: size };
  });

export const getAdminOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) return null;
    const { data: buyer } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, email")
      .eq("id", order.buyer_id)
      .maybeSingle();
    return { ...order, profiles: buyer };
  });

export const forceOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderId: string; status: string; reason?: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("orders").update({ status: data.status }).eq("id", data.orderId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("order_items").update({ status: data.status }).eq("order_id", data.orderId);
    await logAction(context.userId, "order.force_status", "order", data.orderId, { status: data.status, reason: data.reason });
    return { ok: true };
  });
