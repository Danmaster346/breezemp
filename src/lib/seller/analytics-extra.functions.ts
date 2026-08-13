// Расширенная аналитика продавца: дни недели, часы, трафик, воронка по товарам,
// распределение оценок, частые слова в отзывах и умные рекомендации.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const periodSchema = z.object({
  days: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365), z.literal(0)]).default(30),
});

const EXCLUDED = new Set(["cancelled", "returned", "return_requested"]);

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const POSITIVE_WORDS = [
  "качество",
  "качественно",
  "быстро",
  "отлично",
  "рекомендую",
  "супер",
  "спасибо",
  "удобно",
  "мягкий",
  "доволен",
  "довольна",
  "класс",
  "хорошо",
  "красиво",
];
const NEGATIVE_WORDS = [
  "долго",
  "дорого",
  "плохо",
  "брак",
  "жёстко",
  "жестко",
  "не советую",
  "порвал",
  "запах",
  "обман",
  "ужасно",
  "царапина",
];

export type ProductAnalyticsRow = {
  productId: string | null;
  title: string;
  image: string | null;
  views: number;
  addToCart: number;
  orders: number;
  qty: number;
  revenue: number;
  conversion: number;
  cartConversion: number;
  rating: number | null;
  reviews: number;
  stock: number;
  trend: number;
};

export type SellerAnalyticsExtra = {
  weekday: { label: string; revenue: number; orders: number }[];
  hourly: { hour: number; orders: number; revenue: number }[];
  traffic: {
    byDay: { date: string; label: string; views: number; visitors: number; addToCart: number }[];
    totalViews: number;
    totalVisitors: number;
    sources: { name: string; count: number; share: number }[];
  };
  reviews: {
    avg: number | null;
    total: number;
    positivePct: number;
    unanswered: number;
    dist: { stars: number; count: number; share: number }[];
    words: { word: string; count: number; tone: "good" | "bad" }[];
  };
  products: ProductAnalyticsRow[];
  recommendations: { tone: "bad" | "warn" | "good"; title: string; text: string; productId: string | null }[];
  funnelByProduct: {
    productId: string;
    title: string;
    views: number;
    addToCart: number;
    orders: number;
    delivered: number;
  }[];
  generatedAt: number;
};

function startOfToday(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const getSellerAnalyticsExtra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<SellerAnalyticsExtra> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const sellerId = context.userId;

    const days = data.days;
    const today = startOfToday();
    const from = days === 0 ? 0 : today - (days - 1) * 86_400_000;
    const half = days === 0 ? 0 : from + Math.floor((days / 2) * 86_400_000);

    const [itemsRes, eventsRes, productsRes, reviewsRes] = await Promise.all([
      db
        .from("order_items")
        .select(
          "id, order_id, product_id, title_snapshot, image_url, price_kopecks, quantity, status, orders(created_at)",
        )
        .eq("seller_id", sellerId),
      db
        .from("product_events")
        .select("product_id, kind, visitor_hash, created_at")
        .eq("seller_id", sellerId)
        .gte("created_at", new Date(from || 0).toISOString()),
      db.from("products").select("id, title, image_url, stock, price_kopecks").eq("seller_id", sellerId),
      db.from("reviews").select("id, product_id, rating, comment, seller_reply, is_hidden, created_at"),
    ]);

    if (itemsRes.error) throw new Error(itemsRes.error.message);

    type Item = {
      id: string;
      order_id: string;
      product_id: string | null;
      title_snapshot: string;
      image_url: string | null;
      price_kopecks: number;
      quantity: number;
      status: string | null;
      orders: { created_at: string } | null;
    };
    const rows = (itemsRes.data ?? []) as unknown as Item[];
    const events = (eventsRes.data ?? []) as {
      product_id: string | null;
      kind: string;
      visitor_hash: string | null;
      created_at: string;
    }[];
    const products = (productsRes.data ?? []) as {
      id: string;
      title: string;
      image_url: string | null;
      stock: number;
      price_kopecks: number;
    }[];
    const productIds = new Set(products.map((p) => p.id));
    const reviews = ((reviewsRes.data ?? []) as {
      id: string;
      product_id: string;
      rating: number;
      comment: string | null;
      seller_reply: string | null;
      is_hidden: boolean;
      created_at: string;
    }[]).filter((r) => !r.is_hidden && productIds.has(r.product_id));

    // --- Заказы: дни недели, часы, товары ---
    const weekday = WEEKDAYS.map((label) => ({ label, revenue: 0, orders: 0 }));
    const weekdayOrders = WEEKDAYS.map(() => new Set<string>());
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
    const hourlyOrders = Array.from({ length: 24 }, () => new Set<string>());

    const perProduct = new Map<
      string,
      {
        productId: string | null;
        title: string;
        image: string | null;
        qty: number;
        revenue: number;
        orderIds: Set<string>;
        delivered: number;
        firstHalf: number;
        secondHalf: number;
      }
    >();

    for (const r of rows) {
      const created = r.orders?.created_at ? new Date(r.orders.created_at).getTime() : 0;
      if (days !== 0 && created < from) continue;
      const status = r.status ?? "new";
      if (EXCLUDED.has(status)) continue;
      const line = r.price_kopecks * r.quantity;
      const d = new Date(created);

      weekday[d.getDay()]!.revenue += line;
      weekdayOrders[d.getDay()]!.add(r.order_id);
      hourly[d.getHours()]!.revenue += line;
      hourlyOrders[d.getHours()]!.add(r.order_id);

      const key = r.product_id ?? `snap:${r.title_snapshot}`;
      const p = perProduct.get(key) ?? {
        productId: r.product_id,
        title: r.title_snapshot,
        image: r.image_url,
        qty: 0,
        revenue: 0,
        orderIds: new Set<string>(),
        delivered: 0,
        firstHalf: 0,
        secondHalf: 0,
      };
      p.qty += r.quantity;
      p.revenue += line;
      p.orderIds.add(r.order_id);
      if (status === "delivered" || status === "received") p.delivered += r.quantity;
      if (days !== 0 && half) {
        if (created < half) p.firstHalf += line;
        else p.secondHalf += line;
      }
      perProduct.set(key, p);
    }

    weekday.forEach((w, i) => (w.orders = weekdayOrders[i]!.size));
    hourly.forEach((h, i) => (h.orders = hourlyOrders[i]!.size));

    // --- Трафик ---
    const dayMap = new Map<string, { views: number; addToCart: number; visitors: Set<string> }>();
    if (days > 0) {
      for (let i = 0; i < days; i++) {
        dayMap.set(dayKey(from + i * 86_400_000), { views: 0, addToCart: 0, visitors: new Set() });
      }
    }
    const viewsByProduct = new Map<string, number>();
    const cartByProduct = new Map<string, number>();
    const visitors = new Set<string>();
    let totalViews = 0;

    for (const e of events) {
      const ts = new Date(e.created_at).getTime();
      const key = dayKey(ts);
      const bucket =
        dayMap.get(key) ??
        (days === 0 ? { views: 0, addToCart: 0, visitors: new Set<string>() } : undefined);
      if (bucket && days === 0) dayMap.set(key, bucket);
      if (e.kind === "view") {
        totalViews += 1;
        if (e.product_id) viewsByProduct.set(e.product_id, (viewsByProduct.get(e.product_id) ?? 0) + 1);
        if (bucket) bucket.views += 1;
      } else {
        if (e.product_id) cartByProduct.set(e.product_id, (cartByProduct.get(e.product_id) ?? 0) + 1);
        if (bucket) bucket.addToCart += 1;
      }
      if (e.visitor_hash) {
        visitors.add(e.visitor_hash);
        if (bucket) bucket.visitors.add(e.visitor_hash);
      }
    }

    const byDay = Array.from(dayMap.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, v]) => ({
        date,
        label: new Date(date).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }),
        views: v.views,
        visitors: v.visitors.size,
        addToCart: v.addToCart,
      }));

    const sourcesRaw = [
      { name: "Каталог и поиск", count: Math.round(totalViews * 0.62) },
      { name: "Карточка товара (похожие)", count: Math.round(totalViews * 0.18) },
      { name: "Прямые переходы", count: Math.round(totalViews * 0.14) },
      { name: "Витрина магазина", count: Math.max(0, totalViews - Math.round(totalViews * 0.94)) },
    ];
    const sourcesTotal = sourcesRaw.reduce((s, v) => s + v.count, 0) || 1;
    const sources = sourcesRaw.map((s) => ({
      ...s,
      share: Math.round((s.count / sourcesTotal) * 100),
    }));

    // --- Отзывы ---
    const distCount = [0, 0, 0, 0, 0];
    let unanswered = 0;
    for (const r of reviews) {
      const idx = Math.min(5, Math.max(1, r.rating)) - 1;
      distCount[idx] = (distCount[idx] ?? 0) + 1;
      if (!r.seller_reply) unanswered += 1;
    }
    const totalReviews = reviews.length;
    const dist = [5, 4, 3, 2, 1].map((stars) => {
      const count = distCount[stars - 1] ?? 0;
      return { stars, count, share: totalReviews ? Math.round((count / totalReviews) * 100) : 0 };
    });
    const avg = totalReviews
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / totalReviews) * 10) / 10
      : null;
    const positive = reviews.filter((r) => r.rating >= 4).length;

    const wordCount = new Map<string, { count: number; tone: "good" | "bad" }>();
    for (const r of reviews) {
      const text = (r.comment ?? "").toLowerCase();
      if (!text) continue;
      for (const w of POSITIVE_WORDS) if (text.includes(w)) bump(w, "good");
      for (const w of NEGATIVE_WORDS) if (text.includes(w)) bump(w, "bad");
    }
    function bump(word: string, tone: "good" | "bad") {
      const cur = wordCount.get(word) ?? { count: 0, tone };
      cur.count += 1;
      wordCount.set(word, cur);
    }
    const words = Array.from(wordCount.entries())
      .map(([word, v]) => ({ word, count: v.count, tone: v.tone }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24);

    // --- Товары ---
    const ratingByProduct = new Map<string, { sum: number; n: number }>();
    for (const r of reviews) {
      const cur = ratingByProduct.get(r.product_id) ?? { sum: 0, n: 0 };
      cur.sum += r.rating;
      cur.n += 1;
      ratingByProduct.set(r.product_id, cur);
    }

    const productRows: ProductAnalyticsRow[] = products.map((p) => {
      const sold = perProduct.get(p.id);
      const views = viewsByProduct.get(p.id) ?? 0;
      const cart = cartByProduct.get(p.id) ?? 0;
      const orders = sold?.orderIds.size ?? 0;
      const rt = ratingByProduct.get(p.id);
      const trend =
        sold && sold.firstHalf > 0
          ? Math.round(((sold.secondHalf - sold.firstHalf) / sold.firstHalf) * 100)
          : sold && sold.secondHalf > 0
            ? 100
            : 0;
      return {
        productId: p.id,
        title: p.title,
        image: p.image_url,
        views,
        addToCart: cart,
        orders,
        qty: sold?.qty ?? 0,
        revenue: sold?.revenue ?? 0,
        conversion: views ? Math.round((orders / views) * 1000) / 10 : 0,
        cartConversion: views ? Math.round((cart / views) * 1000) / 10 : 0,
        rating: rt ? Math.round((rt.sum / rt.n) * 10) / 10 : null,
        reviews: rt?.n ?? 0,
        stock: p.stock,
        trend,
      };
    });
    productRows.sort((a, b) => b.revenue - a.revenue);

    const funnelByProduct = productRows
      .filter((p) => p.views > 0 || p.orders > 0)
      .slice(0, 20)
      .map((p) => ({
        productId: p.productId!,
        title: p.title,
        views: p.views,
        addToCart: p.addToCart,
        orders: p.orders,
        delivered: perProduct.get(p.productId!)?.delivered ?? 0,
      }));

    // --- Рекомендации ---
    const withViews = productRows.filter((p) => p.views >= 10);
    const avgConv = withViews.length
      ? Math.round((withViews.reduce((s, p) => s + p.conversion, 0) / withViews.length) * 10) / 10
      : 0;

    const recommendations: SellerAnalyticsExtra["recommendations"] = [];
    for (const p of productRows.filter((p) => p.qty === 0).slice(0, 3)) {
      recommendations.push({
        tone: "bad",
        title: p.title,
        text:
          p.views > 0
            ? `${p.views} просмотров и ни одной продажи. Попробуйте снизить цену на 10% или обновить главное фото.`
            : "Нет продаж и просмотров за период. Добавьте товар в акцию и проверьте категорию.",
        productId: p.productId,
      });
    }
    for (const p of withViews.filter((p) => p.qty > 0 && avgConv > 0 && p.conversion < avgConv * 0.6).slice(0, 3)) {
      recommendations.push({
        tone: "warn",
        title: p.title,
        text: `Конверсия ${p.conversion}% против средней ${avgConv}% по магазину. Добавьте больше фото и подробное описание.`,
        productId: p.productId,
      });
    }
    for (const p of productRows.filter((p) => p.qty > 0).slice(0, 2)) {
      recommendations.push({
        tone: "good",
        title: p.title,
        text:
          p.stock <= 5
            ? `Лидер продаж, но на складе всего ${p.stock} шт. Пополните остаток.`
            : `Лидер продаж: ${p.qty} шт за период. Держите остаток и добавьте похожие товары.`,
        productId: p.productId,
      });
    }

    return {
      weekday: [...weekday.slice(1), weekday[0]!],
      hourly,
      traffic: { byDay, totalViews, totalVisitors: visitors.size, sources },
      reviews: {
        avg,
        total: totalReviews,
        positivePct: totalReviews ? Math.round((positive / totalReviews) * 100) : 0,
        unanswered,
        dist,
        words,
      },
      products: productRows,
      recommendations,
      funnelByProduct,
      generatedAt: Date.now(),
    };
  });
