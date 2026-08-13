// Расширенные данные дашборда: статус магазина, заполненность профиля,
// сравнение выручки с вчера, счётчики товаров, график продаж и лента активности.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DAY = 86_400_000;
const EXCLUDED = new Set(["cancelled", "returned", "return_requested"]);

export type SellerProfileHealth = {
  shopName: string | null;
  status: "active" | "moderation" | "blocked";
  completeness: number;
  hints: string[];
};

export type SellerCounters = {
  revenueToday: number;
  revenueYesterday: number;
  activeOrders: number;
  newOrdersToday: number;
  activeProducts: number;
  pendingProducts: number;
  rejectedProducts: number;
  avgRating: number;
  reviewsCount: number;
  rank: number | null;
  sellersTotal: number;
  lowStock: number;
  noPhoto: number;
  reviewsWaiting: number;
  unread: number;
};

export type ActivityEvent = {
  id: string;
  kind: "order" | "review" | "moderation" | "message" | "payout";
  text: string;
  at: string;
};

export type SellerDashboardExtra = {
  profile: SellerProfileHealth;
  counters: SellerCounters;
  activity: ActivityEvent[];
};

function startOfToday(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export const getSellerDashboardExtra = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SellerDashboardExtra> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const sellerId = context.userId;
    const today = startOfToday();
    const yesterday = today - DAY;

    const [profileRes, productsRes, itemsRes, convRes, payoutsRes] = await Promise.all([
      db
        .from("seller_profiles")
        .select("shop_name, logo_path, short_description, full_description, phone, email, balance_frozen")
        .eq("user_id", sellerId)
        .maybeSingle(),
      db
        .from("products")
        .select("id, title, stock, min_stock, image_url, image_urls, is_active, moderation_status, moderated_at")
        .eq("seller_id", sellerId),
      db
        .from("order_items")
        .select("id, order_id, price_kopecks, quantity, quantity, status, title_snapshot, orders(created_at)")
        .eq("seller_id", sellerId)
        .order("id", { ascending: false })
        .limit(500),
      db
        .from("conversation_participants")
        .select("unread_count, updated_at")
        .eq("user_id", sellerId),
      db
        .from("payouts")
        .select("id, amount_kopecks, created_at, status")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const prods = productsRes.data ?? [];
    const productIds = prods.map((p) => p.id);

    // Отзывы на свои товары
    let reviews: { id: string; rating: number; created_at: string; product_id: string; seller_reply: string | null; comment: string | null }[] = [];
    if (productIds.length > 0) {
      const { data } = await db
        .from("reviews")
        .select("id, rating, created_at, product_id, seller_reply, comment")
        .in("product_id", productIds)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(200);
      reviews = (data ?? []) as typeof reviews;
    }

    // Заполненность профиля магазина
    const p = profileRes.data;
    const checks = [
      { ok: !!p?.shop_name, hint: "⚠️ Укажите название магазина" },
      { ok: !!p?.logo_path, hint: "⚠️ Добавьте логотип магазина" },
      { ok: !!p?.short_description, hint: "⚠️ Заполните краткое описание" },
      { ok: !!p?.full_description, hint: "⚠️ Заполните описание магазина" },
      { ok: !!(p?.phone || p?.email), hint: "⚠️ Добавьте контакт для связи" },
      { ok: prods.length > 0, hint: "⚠️ Добавьте первый товар" },
    ];
    const completeness = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
    const hasActive = prods.some((x) => x.is_active && x.moderation_status === "approved");
    const status: SellerProfileHealth["status"] = p?.balance_frozen
      ? "blocked"
      : hasActive
        ? "active"
        : "moderation";

    // Выручка и заказы
    type Item = {
      id: string;
      order_id: string;
      price_kopecks: number;
      quantity: number;
      status: string;
      title_snapshot: string;
      orders: { created_at: string } | null;
    };
    const items = (itemsRes.data ?? []) as unknown as Item[];
    let revenueToday = 0;
    let revenueYesterday = 0;
    const activeOrders = new Set<string>();
    const newToday = new Set<string>();
    for (const it of items) {
      const at = it.orders?.created_at ? new Date(it.orders.created_at).getTime() : 0;
      if (!EXCLUDED.has(it.status) && !["delivered", "received"].includes(it.status))
        activeOrders.add(it.order_id);
      if (at >= today && ["new", "confirmed", "processing"].includes(it.status))
        newToday.add(it.order_id);
      if (EXCLUDED.has(it.status)) continue;
      const sum = it.price_kopecks * it.quantity;
      if (at >= today) revenueToday += sum;
      else if (at >= yesterday) revenueYesterday += sum;
    }

    const reviewsCount = reviews.length;
    const avgRating = reviewsCount ? reviews.reduce((s, r) => s + r.rating, 0) / reviewsCount : 0;

    // Место в топе продавцов по среднему рейтингу
    let rank: number | null = null;
    let sellersTotal = 0;
    {
      const { data: allProducts } = await db.from("products").select("id, seller_id");
      const { data: allReviews } = await db.from("reviews").select("product_id, rating").eq("is_hidden", false);
      const ownerOf = new Map((allProducts ?? []).map((x) => [x.id, x.seller_id]));
      const agg = new Map<string, { sum: number; n: number }>();
      for (const r of allReviews ?? []) {
        const owner = ownerOf.get(r.product_id);
        if (!owner) continue;
        const cur = agg.get(owner) ?? { sum: 0, n: 0 };
        cur.sum += r.rating;
        cur.n += 1;
        agg.set(owner, cur);
      }
      const board = [...agg.entries()]
        .map(([id, v]) => ({ id, avg: v.sum / v.n, n: v.n }))
        .sort((a, b) => b.avg - a.avg || b.n - a.n);
      sellersTotal = board.length;
      const idx = board.findIndex((b) => b.id === sellerId);
      rank = idx >= 0 ? idx + 1 : null;
    }

    const unread = (convRes.data ?? []).reduce((s, c) => s + (c.unread_count ?? 0), 0);

    const counters: SellerCounters = {
      revenueToday,
      revenueYesterday,
      activeOrders: activeOrders.size,
      newOrdersToday: newToday.size,
      activeProducts: prods.filter((x) => x.is_active && x.moderation_status === "approved").length,
      pendingProducts: prods.filter((x) => x.moderation_status === "pending").length,
      rejectedProducts: prods.filter((x) => x.moderation_status === "rejected").length,
      avgRating,
      reviewsCount,
      rank,
      sellersTotal,
      lowStock: prods.filter((x) => x.stock > 0 && x.stock <= Math.max(x.min_stock ?? 5, 1)).length,
      noPhoto: prods.filter((x) => !x.image_url && (x.image_urls ?? []).length === 0).length,
      reviewsWaiting: reviews.filter((r) => !r.seller_reply).length,
      unread,
    };

    // Лента активности
    const titleOf = new Map(prods.map((x) => [x.id, x.title]));
    const activity: ActivityEvent[] = [];
    const seenOrders = new Set<string>();
    for (const it of items) {
      if (!it.orders?.created_at || seenOrders.has(it.order_id)) continue;
      seenOrders.add(it.order_id);
      activity.push({
        id: `order-${it.order_id}`,
        kind: "order",
        text: `Новый заказ #${it.order_id.slice(0, 8)} — ${it.title_snapshot}`,
        at: it.orders.created_at,
      });
    }
    for (const r of reviews.slice(0, 10)) {
      activity.push({
        id: `review-${r.id}`,
        kind: "review",
        text: `Новый отзыв ${r.rating}★ на «${titleOf.get(r.product_id) ?? "товар"}»`,
        at: r.created_at,
      });
    }
    for (const x of prods) {
      if (!x.moderated_at) continue;
      activity.push({
        id: `mod-${x.id}`,
        kind: "moderation",
        text:
          x.moderation_status === "approved"
            ? `Товар «${x.title}» одобрен`
            : x.moderation_status === "rejected"
              ? `Товар «${x.title}» отклонён`
              : `Товар «${x.title}» на модерации`,
        at: x.moderated_at,
      });
    }
    for (const pay of payoutsRes.data ?? []) {
      activity.push({
        id: `payout-${pay.id}`,
        kind: "payout",
        text: `Выплата ${(pay.amount_kopecks / 100).toLocaleString("ru-RU")} ₽ — ${pay.status}`,
        at: pay.created_at,
      });
    }
    activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return {
      profile: {
        shopName: p?.shop_name ?? null,
        status,
        completeness,
        hints: checks.filter((c) => !c.ok).map((c) => c.hint),
      },
      counters,
      activity: activity.slice(0, 10),
    };
  });

const seriesSchema = z.object({ range: z.enum(["7d", "30d", "3m", "1y"]) });

export type SalesPoint = { label: string; revenue: number; orders: number };

/** Ряд продаж для графика: по дням (7/30) или по месяцам (3м/год). */
export const getSellerSalesSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => seriesSchema.parse(d))
  .handler(async ({ data, context }): Promise<SalesPoint[]> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const days = data.range === "7d" ? 7 : data.range === "30d" ? 30 : data.range === "3m" ? 92 : 365;
    const from = startOfToday() - (days - 1) * DAY;

    const { data: rows, error } = await db
      .from("order_items")
      .select("order_id, price_kopecks, quantity, status, orders(created_at)")
      .eq("seller_id", context.userId)
      .gte("orders.created_at", new Date(from).toISOString());
    if (error) throw new Error(error.message);

    const monthly = data.range === "3m" || data.range === "1y";
    const buckets = new Map<string, { revenue: number; orders: Set<string> }>();
    const keyOf = (t: number) => {
      const d = new Date(t);
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return monthly ? `${d.getFullYear()}-${m}` : `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, "0")}`;
    };

    for (let i = 0; i < days; i += 1) {
      const key = keyOf(from + i * DAY);
      if (!buckets.has(key)) buckets.set(key, { revenue: 0, orders: new Set() });
    }

    type Row = {
      order_id: string;
      price_kopecks: number;
      quantity: number;
      status: string;
      orders: { created_at: string } | null;
    };
    for (const r of (rows ?? []) as unknown as Row[]) {
      if (!r.orders?.created_at) continue;
      const t = new Date(r.orders.created_at).getTime();
      if (t < from) continue;
      const b = buckets.get(keyOf(t));
      if (!b) continue;
      b.orders.add(r.order_id);
      if (!EXCLUDED.has(r.status)) b.revenue += r.price_kopecks * r.quantity;
    }

    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => {
        const parts = key.split("-");
        const label = monthly ? `${parts[1]}.${parts[0].slice(2)}` : `${parts[2]}.${parts[1]}`;
        return { label, revenue: v.revenue, orders: v.orders.size };
      });
  });
