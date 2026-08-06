// Панель задач продавца: что требует действия прямо сейчас.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LOW_STOCK = 10;

export const getSellerTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const sellerId = context.userId;

    const [items, products, convs, reviews] = await Promise.all([
      db.from("order_items").select("status").eq("seller_id", sellerId),
      db.from("products").select("id, stock, is_active, moderation_status").eq("seller_id", sellerId),
      db
        .from("conversation_participants")
        .select("unread_count")
        .eq("user_id", sellerId)
        .gt("unread_count", 0),
      db.from("reviews").select("rating, product_id, is_hidden"),
    ]);

    const rows = items.data ?? [];
    const newOrders = rows.filter((r) => ["new", "processing", "confirmed"].includes(r.status)).length;
    const toShip = rows.filter((r) => ["assembling", "packing"].includes(r.status)).length;
    const returns = rows.filter((r) => ["return_requested", "returned"].includes(r.status)).length;

    const prods = products.data ?? [];
    const productIds = new Set(prods.map((p) => p.id));
    const lowStock = prods.filter((p) => p.stock > 0 && p.stock < LOW_STOCK).length;
    const outOfStock = prods.filter((p) => p.stock === 0).length;
    const pendingModeration = prods.filter((p) => p.moderation_status === "pending").length;
    const hidden = prods.filter((p) => !p.is_active).length;

    const unread = (convs.data ?? []).reduce((s, c) => s + (c.unread_count ?? 0), 0);

    const mine = (reviews.data ?? []).filter((r) => !r.is_hidden && productIds.has(r.product_id));
    const lowRated = mine.filter((r) => r.rating <= 3).length;

    return {
      newOrders,
      toShip,
      returns,
      lowStock,
      outOfStock,
      pendingModeration,
      hidden,
      unread,
      lowRated,
    };
  });
