// Сводка для дашборда продавца: выручка по периодам, заказы в обработке,
// рейтинг магазина, просмотры за 7 дней и мини-график выручки за 14 дней.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Статусы, которые не считаем выручкой. */
const EXCLUDED = new Set(["cancelled", "returned", "return_requested"]);
/** Статусы «в обработке» — заказ ещё не доставлен. */
const PROCESSING = new Set(["new", "processing", "confirmed", "assembling", "packing", "shipping", "shipped"]);

export type SellerDashboardSummary = {
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  processingOrders: number;
  newOrders: number;
  avgRating: number;
  reviewsCount: number;
  views7d: number;
  spark: { day: string; value: number }[];
  pendingModeration: number;
  unread: number;
};

function startOfDay(d = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const DAY = 24 * 60 * 60 * 1000;

export const getSellerDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SellerDashboardSummary> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const sellerId = context.userId;

    const today = startOfDay();
    const weekAgo = today - 6 * DAY;
    const monthAgo = today - 29 * DAY;
    const sparkFrom = today - 13 * DAY;

    const [items, products, convs, events] = await Promise.all([
      db
        .from("order_items")
        .select("order_id, price_kopecks, quantity, status, orders(created_at)")
        .eq("seller_id", sellerId),
      db.from("products").select("id, moderation_status").eq("seller_id", sellerId),
      db
        .from("conversation_participants")
        .select("unread_count")
        .eq("user_id", sellerId)
        .gt("unread_count", 0),
      db
        .from("product_events")
        .select("id")
        .eq("seller_id", sellerId)
        .eq("kind", "view")
        .gte("created_at", new Date(weekAgo).toISOString()),
    ]);

    type Row = {
      order_id: string;
      price_kopecks: number;
      quantity: number;
      status: string;
      orders: { created_at: string } | null;
    };
    const rows = (items.data ?? []) as unknown as Row[];

    let revenueToday = 0;
    let revenueWeek = 0;
    let revenueMonth = 0;
    const processing = new Set<string>();
    const fresh = new Set<string>();
    const byDay = new Map<string, number>();

    for (const r of rows) {
      const created = r.orders?.created_at ? new Date(r.orders.created_at).getTime() : 0;
      if (PROCESSING.has(r.status)) processing.add(r.order_id);
      if (["new", "processing", "confirmed"].includes(r.status)) fresh.add(r.order_id);
      if (EXCLUDED.has(r.status)) continue;
      const sum = r.price_kopecks * r.quantity;
      if (created >= today) revenueToday += sum;
      if (created >= weekAgo) revenueWeek += sum;
      if (created >= monthAgo) revenueMonth += sum;
      if (created >= sparkFrom) {
        const d = new Date(created);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        byDay.set(key, (byDay.get(key) ?? 0) + sum);
      }
    }

    const spark: { day: string; value: number }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(today - i * DAY);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      spark.push({ day: key, value: byDay.get(key) ?? 0 });
    }

    const prods = products.data ?? [];
    const productIds = prods.map((p) => (p as { id: string }).id);
    const pendingModeration = prods.filter(
      (p) => (p as { moderation_status: string }).moderation_status === "pending",
    ).length;

    let avgRating = 0;
    let reviewsCount = 0;
    if (productIds.length > 0) {
      const { data: reviews } = await db
        .from("reviews")
        .select("rating")
        .in("product_id", productIds)
        .eq("is_hidden", false);
      reviewsCount = reviews?.length ?? 0;
      if (reviewsCount > 0)
        avgRating =
          (reviews ?? []).reduce((s, r) => s + (r as { rating: number }).rating, 0) / reviewsCount;
    }

    return {
      revenueToday,
      revenueWeek,
      revenueMonth,
      processingOrders: processing.size,
      newOrders: fresh.size,
      avgRating,
      reviewsCount,
      views7d: events.data?.length ?? 0,
      spark,
      pendingModeration,
      unread: (convs.data ?? []).reduce(
        (s, c) => s + ((c as { unread_count: number | null }).unread_count ?? 0),
        0,
      ),
    };
  });
