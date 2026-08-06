// Аналитика продавца: периоды со сравнением, ряды по дням, воронка,
// топ/залежавшиеся товары, категории, доставка, качество, города, экспорт CSV.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type ItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  title_snapshot: string;
  image_url: string | null;
  price_kopecks: number;
  quantity: number;
  commission_kopecks: number;
  status: string;
  shipped_at: string | null;
  orders: {
    created_at: string;
    shipping_method: string | null;
    shipping_address: string | null;
  } | null;
};

const EARNED = new Set(["delivered", "received"]);
const EXCLUDE_FROM_SALES = new Set(["cancelled", "returned", "return_requested"]);
const DELIVERED = new Set(["delivered", "received"]);

const periodSchema = z.object({
  days: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(0)]).default(30),
});

/** Метка дня YYYY-MM-DD по локальному времени сервера. */
function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfToday(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}

/** Извлекаем город из строки адреса: берём самую «городскую» часть. */
function guessCity(address: string | null): string {
  if (!address) return "Не указан";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  const cityPart =
    parts.find((p) => /^(г\.?|город|г )/i.test(p)) ??
    parts.find((p) => !/^\d/.test(p) && !/(ул|улица|д\.|дом|кв|индекс|обл)/i.test(p)) ??
    parts[0];
  return (cityPart ?? "Не указан").replace(/^(г\.?|город)\s*/i, "").slice(0, 40) || "Не указан";
}

export type SellerAnalytics = {
  period: { days: number; label: string; from: number };
  kpi: {
    revenue: number;
    orders: number;
    avgOrder: number;
    itemsSold: number;
    views: number;
    addToCart: number;
    earnedPayout: number;
  };
  prev: { revenue: number; orders: number; avgOrder: number; itemsSold: number; views: number };
  series: { date: string; label: string; revenue: number; orders: number; views: number }[];
  funnel: { views: number; addToCart: number; ordered: number; delivered: number };
  top: { productId: string | null; title: string; image: string | null; qty: number; revenue: number; views: number }[];
  stale: { productId: string; title: string; image: string | null; views: number; stock: number; reason: string }[];
  categories: { name: string; revenue: number; share: number }[];
  shipping: { method: string; orders: number }[];
  cities: { city: string; orders: number }[];
  quality: {
    cancelRate: number;
    returnRate: number;
    avgShipHours: number | null;
    rating: number | null;
    reviews: number;
  };
  byStatus: Record<string, number>;
  generatedAt: number;
};

const PERIOD_LABEL: Record<number, string> = {
  7: "7 дней",
  30: "30 дней",
  90: "90 дней",
  0: "Всё время",
};

export const getSellerAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<SellerAnalytics> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const sellerId = context.userId;

    const days = data.days;
    const today = startOfToday();
    const from = days === 0 ? 0 : today - (days - 1) * 86_400_000;
    const prevFrom = days === 0 ? 0 : from - days * 86_400_000;

    const [itemsRes, eventsRes, productsRes, reviewsRes, catsRes] = await Promise.all([
      db
        .from("order_items")
        .select(
          "id, order_id, product_id, title_snapshot, image_url, price_kopecks, quantity, commission_kopecks, status, shipped_at, orders(created_at, shipping_method, shipping_address)",
        )
        .eq("seller_id", sellerId),
      db
        .from("product_events")
        .select("product_id, kind, created_at")
        .eq("seller_id", sellerId)
        .gte("created_at", new Date(prevFrom || 0).toISOString()),
      db
        .from("products")
        .select("id, title, image_url, stock, category_id, created_at")
        .eq("seller_id", sellerId),
      db.from("reviews").select("rating, product_id, is_hidden"),
      db.from("categories").select("id, name"),
    ]);

    if (itemsRes.error) throw new Error(itemsRes.error.message);
    const rows = (itemsRes.data ?? []) as unknown as ItemRow[];
    const events = (eventsRes.data ?? []) as { product_id: string | null; kind: string; created_at: string }[];
    const products = (productsRes.data ?? []) as {
      id: string;
      title: string;
      image_url: string | null;
      stock: number;
      category_id: string | null;
      created_at: string;
    }[];
    const productIds = new Set(products.map((p) => p.id));
    const reviews = ((reviewsRes.data ?? []) as { rating: number; product_id: string; is_hidden: boolean }[]).filter(
      (r) => !r.is_hidden && productIds.has(r.product_id),
    );
    const catName = new Map((catsRes.data ?? []).map((c) => [c.id as string, c.name as string]));

    // --- Ряды по дням ---
    const seriesMap = new Map<string, { revenue: number; orderIds: Set<string>; views: number }>();
    if (days > 0) {
      for (let i = 0; i < days; i++) {
        const key = dayKey(from + i * 86_400_000);
        seriesMap.set(key, { revenue: 0, orderIds: new Set(), views: 0 });
      }
    }

    const cur = { revenue: 0, items: 0, orderIds: new Set<string>() };
    const prev = { revenue: 0, items: 0, orderIds: new Set<string>() };
    let earnedPayout = 0;
    let deliveredItems = 0;
    let cancelled = 0;
    let returned = 0;
    let totalCounted = 0;
    let shipHoursSum = 0;
    let shipHoursN = 0;

    const byStatus: Record<string, number> = {};
    const topMap = new Map<
      string,
      { productId: string | null; title: string; image: string | null; qty: number; revenue: number }
    >();
    const catRevenue = new Map<string, number>();
    const shipMap = new Map<string, Set<string>>();
    const cityMap = new Map<string, Set<string>>();
    const productCat = new Map(products.map((p) => [p.id, p.category_id]));
    const soldRecently = new Set<string>();

    for (const r of rows) {
      const created = r.orders?.created_at ? new Date(r.orders.created_at).getTime() : 0;
      const line = r.price_kopecks * r.quantity;
      const status = r.status ?? "new";
      const inCur = days === 0 || created >= from;
      const inPrev = days > 0 && created >= prevFrom && created < from;

      if (inCur) {
        byStatus[status] = (byStatus[status] ?? 0) + 1;
        totalCounted += 1;
        if (status === "cancelled") cancelled += 1;
        if (status === "returned" || status === "return_requested") returned += 1;
        if (r.shipped_at && created) {
          const h = (new Date(r.shipped_at).getTime() - created) / 3_600_000;
          if (h >= 0 && h < 24 * 60) {
            shipHoursSum += h;
            shipHoursN += 1;
          }
        }
      }

      if (EXCLUDE_FROM_SALES.has(status)) continue;

      if (inCur) {
        cur.revenue += line;
        cur.items += r.quantity;
        cur.orderIds.add(r.order_id);
        if (DELIVERED.has(status)) deliveredItems += r.quantity;
        if (EARNED.has(status)) earnedPayout += line - r.commission_kopecks;

        const key = r.product_id ?? `snap:${r.title_snapshot}`;
        const t = topMap.get(key) ?? {
          productId: r.product_id,
          title: r.title_snapshot,
          image: r.image_url,
          qty: 0,
          revenue: 0,
        };
        t.qty += r.quantity;
        t.revenue += line;
        topMap.set(key, t);

        const cid = r.product_id ? productCat.get(r.product_id) ?? null : null;
        const cname = cid ? catName.get(cid) ?? "Без категории" : "Без категории";
        catRevenue.set(cname, (catRevenue.get(cname) ?? 0) + line);

        const method = r.orders?.shipping_method || "не указан";
        if (!shipMap.has(method)) shipMap.set(method, new Set());
        shipMap.get(method)!.add(r.order_id);

        const city = guessCity(r.orders?.shipping_address ?? null);
        if (!cityMap.has(city)) cityMap.set(city, new Set());
        cityMap.get(city)!.add(r.order_id);

        const bucket = seriesMap.get(dayKey(created));
        if (bucket) {
          bucket.revenue += line;
          bucket.orderIds.add(r.order_id);
        }
      }

      if (inPrev) {
        prev.revenue += line;
        prev.items += r.quantity;
        prev.orderIds.add(r.order_id);
      }

      if (r.product_id && created >= today - 29 * 86_400_000) soldRecently.add(r.product_id);
    }

    // --- События (просмотры / корзина) ---
    let views = 0;
    let addToCart = 0;
    let prevViews = 0;
    const viewsByProduct = new Map<string, number>();
    for (const e of events) {
      const ts = new Date(e.created_at).getTime();
      const inCur = days === 0 || ts >= from;
      const inPrev = days > 0 && ts >= prevFrom && ts < from;
      if (inCur) {
        if (e.kind === "view") {
          views += 1;
          if (e.product_id) viewsByProduct.set(e.product_id, (viewsByProduct.get(e.product_id) ?? 0) + 1);
          const b = seriesMap.get(dayKey(ts));
          if (b) b.views += 1;
        } else {
          addToCart += 1;
        }
      } else if (inPrev && e.kind === "view") {
        prevViews += 1;
      }
    }

    const series = Array.from(seriesMap.entries()).map(([date, v]) => {
      const d = new Date(date);
      return {
        date,
        label: d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }),
        revenue: v.revenue,
        orders: v.orderIds.size,
        views: v.views,
      };
    });

    const top = Array.from(topMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((t) => ({ ...t, views: t.productId ? viewsByProduct.get(t.productId) ?? 0 : 0 }));

    const stale = products
      .filter((p) => !soldRecently.has(p.id))
      .map((p) => ({
        productId: p.id,
        title: p.title,
        image: p.image_url,
        views: viewsByProduct.get(p.id) ?? 0,
        stock: p.stock,
        reason:
          (viewsByProduct.get(p.id) ?? 0) > 0
            ? "Смотрят, но не покупают"
            : "Нет продаж и просмотров",
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    const totalCatRevenue = Array.from(catRevenue.values()).reduce((s, v) => s + v, 0) || 1;
    const categories = Array.from(catRevenue.entries())
      .map(([name, revenue]) => ({ name, revenue, share: Math.round((revenue / totalCatRevenue) * 100) }))
      .sort((a, b) => b.revenue - a.revenue);

    const shipping = Array.from(shipMap.entries())
      .map(([method, ids]) => ({ method, orders: ids.size }))
      .sort((a, b) => b.orders - a.orders);

    const cities = Array.from(cityMap.entries())
      .map(([city, ids]) => ({ city, orders: ids.size }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 8);

    const avgOrder = cur.orderIds.size ? Math.round(cur.revenue / cur.orderIds.size) : 0;
    const prevAvg = prev.orderIds.size ? Math.round(prev.revenue / prev.orderIds.size) : 0;
    const rating = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;

    return {
      period: { days, label: PERIOD_LABEL[days] ?? `${days} дней`, from },
      kpi: {
        revenue: cur.revenue,
        orders: cur.orderIds.size,
        avgOrder,
        itemsSold: cur.items,
        views,
        addToCart,
        earnedPayout,
      },
      prev: {
        revenue: prev.revenue,
        orders: prev.orderIds.size,
        avgOrder: prevAvg,
        itemsSold: prev.items,
        views: prevViews,
      },
      series,
      funnel: { views, addToCart, ordered: cur.items, delivered: deliveredItems },
      top,
      stale,
      categories,
      shipping,
      cities,
      quality: {
        cancelRate: totalCounted ? Math.round((cancelled / totalCounted) * 100) : 0,
        returnRate: totalCounted ? Math.round((returned / totalCounted) * 100) : 0,
        avgShipHours: shipHoursN ? Math.round((shipHoursSum / shipHoursN) * 10) / 10 : null,
        rating,
        reviews: reviews.length,
      },
      byStatus,
      generatedAt: Date.now(),
    };
  });

// ===== Экспорт CSV =====

function csv(rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // \uFEFF — BOM, чтобы Excel корректно открыл кириллицу
  return "\uFEFF" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
}

export const exportSellerOrdersCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = data.days === 0 ? 0 : startOfToday() - (data.days - 1) * 86_400_000;
    const { data: rows, error } = await supabaseAdmin
      .from("order_items")
      .select(
        "order_id, title_snapshot, price_kopecks, quantity, commission_kopecks, status, orders(created_at, shipping_method, shipping_address)",
      )
      .eq("seller_id", context.userId);
    if (error) throw new Error(error.message);

    const filtered = ((rows ?? []) as unknown as ItemRow[]).filter((r) => {
      const t = r.orders?.created_at ? new Date(r.orders.created_at).getTime() : 0;
      return data.days === 0 || t >= from;
    });

    const out: (string | number | null)[][] = [
      ["Дата", "Заказ", "Товар", "Цена, ₽", "Кол-во", "Сумма, ₽", "Комиссия, ₽", "Статус", "Доставка", "Адрес"],
    ];
    for (const r of filtered) {
      out.push([
        r.orders?.created_at ? new Date(r.orders.created_at).toLocaleString("ru-RU") : "",
        r.order_id.slice(0, 8),
        r.title_snapshot,
        r.price_kopecks / 100,
        r.quantity,
        (r.price_kopecks * r.quantity) / 100,
        r.commission_kopecks / 100,
        r.status,
        r.orders?.shipping_method ?? "",
        r.orders?.shipping_address ?? "",
      ]);
    }
    return { filename: `orders-${new Date().toISOString().slice(0, 10)}.csv`, content: csv(out) };
  });

export const exportSellerProductsCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("products")
      .select("id, title, price_kopecks, compare_at_price_kopecks, stock, is_active, moderation_status, created_at")
      .eq("seller_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const out: (string | number | null)[][] = [
      ["id", "Название", "Цена, ₽", "Старая цена, ₽", "Остаток", "Активен", "Модерация", "Создан"],
    ];
    for (const p of rows ?? []) {
      out.push([
        p.id,
        p.title,
        p.price_kopecks / 100,
        p.compare_at_price_kopecks ? p.compare_at_price_kopecks / 100 : "",
        p.stock,
        p.is_active ? "да" : "нет",
        p.moderation_status,
        new Date(p.created_at).toLocaleDateString("ru-RU"),
      ]);
    }
    return { filename: `products-${new Date().toISOString().slice(0, 10)}.csv`, content: csv(out) };
  });
