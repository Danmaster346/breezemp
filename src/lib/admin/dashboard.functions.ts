import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Статистика для главной страницы админки
export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const periods = {
      today: new Date(now - day).toISOString(),
      week: new Date(now - 7 * day).toISOString(),
      month: new Date(now - 30 * day).toISOString(),
      quarter: new Date(now - 90 * day).toISOString(),
    };

    const [
      { data: newBuyersToday },
      { data: newBuyersWeek },
      { data: newBuyersMonth },
      { data: sellersAll },
      { data: productsWeek },
      { data: productsMonth },
      { data: ordersToday },
      { data: ordersWeek },
      { data: ordersMonth },
      { data: returnItems },
      { data: chartOrders },
      { data: itemsForCats },
      { data: itemsForSellers },
      { data: pendingProducts },
      { data: pendingReturns },
      { data: itemsForTop10 },
      { data: newUsersRaw },
      { data: ordersForRevenueSeries },
      { data: viewEvents },
      { data: profilesAll },
      { data: ordersForBuyers },
      { data: pendingModerationProducts },
      { data: noPhotoCandidates },
      { data: zeroStockProducts },
      { data: newWeekProducts },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id").gte("created_at", periods.today),
      supabaseAdmin.from("profiles").select("id").gte("created_at", periods.week),
      supabaseAdmin.from("profiles").select("id").gte("created_at", periods.month),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "seller"),
      supabaseAdmin.from("products").select("id").gte("created_at", periods.week),
      supabaseAdmin.from("products").select("id").gte("created_at", periods.month),
      supabaseAdmin.from("orders").select("id,total_kopecks,commission_kopecks").gte("created_at", periods.today),
      supabaseAdmin.from("orders").select("id,total_kopecks,commission_kopecks").gte("created_at", periods.week),
      supabaseAdmin.from("orders").select("id,total_kopecks,commission_kopecks").gte("created_at", periods.month),
      supabaseAdmin.from("order_items").select("id").in("status", ["return_requested", "returned"]),
      supabaseAdmin.from("orders").select("created_at,total_kopecks,commission_kopecks").gte("created_at", periods.month).order("created_at"),
      supabaseAdmin.from("order_items").select("price_kopecks,quantity,products(category_id, categories(name))"),
      supabaseAdmin.from("order_items").select("seller_id,price_kopecks,quantity"),
      supabaseAdmin.from("products").select("id").eq("moderation_status", "pending"),
      supabaseAdmin.from("order_items").select("id").eq("status", "return_requested"),
      supabaseAdmin.from("order_items").select("product_id,title_snapshot,price_kopecks,quantity"),
      supabaseAdmin.from("profiles").select("id,created_at").gte("created_at", periods.month),
      supabaseAdmin.from("orders").select("created_at,total_kopecks,buyer_id").gte("created_at", periods.quarter).order("created_at"),
      supabaseAdmin.from("product_events").select("id,created_at").eq("kind", "view").gte("created_at", periods.month),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("orders").select("id,buyer_id,total_kopecks").gte("created_at", periods.month),
      supabaseAdmin
        .from("products")
        .select("id, title, price_kopecks, created_at, seller_id")
        .eq("moderation_status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("products")
        .select("id, title, image_url, image_urls")
        .limit(500),
      supabaseAdmin
        .from("products")
        .select("id, title")
        .eq("stock", 0)
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("products")
        .select("id, title, created_at")
        .gte("created_at", periods.week)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const sum = (arr: { total_kopecks: number | null; commission_kopecks: number | null }[] | null) => {
      const rows = arr ?? [];
      return {
        count: rows.length,
        total: rows.reduce((a, r) => a + (r.total_kopecks ?? 0), 0),
        commission: rows.reduce((a, r) => a + (r.commission_kopecks ?? 0), 0),
      };
    };

    // Daily orders chart (last 30 days)
    const dayMap = new Map<string, { date: string; count: number; revenue: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * day).toISOString().slice(0, 10);
      dayMap.set(d, { date: d, count: 0, revenue: 0 });
    }
    (chartOrders ?? []).forEach((o) => {
      const key = (o.created_at as string).slice(0, 10);
      const bucket = dayMap.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.revenue += (o.total_kopecks ?? 0) / 100;
      }
    });

    // Top categories
    const catMap = new Map<string, { name: string; revenue: number }>();
    (itemsForCats as unknown as Array<{
      price_kopecks: number;
      quantity: number;
      products: { category_id: string | null; categories: { name: string } | null } | null;
    }> | null ?? []).forEach((it) => {
      const catName = it.products?.categories?.name ?? "Без категории";
      const cur = catMap.get(catName) ?? { name: catName, revenue: 0 };
      cur.revenue += (it.price_kopecks * it.quantity) / 100;
      catMap.set(catName, cur);
    });
    const topCategories = [...catMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Top sellers
    const sellerMap = new Map<string, number>();
    (itemsForSellers ?? []).forEach((it) => {
      sellerMap.set(it.seller_id, (sellerMap.get(it.seller_id) ?? 0) + (it.price_kopecks * it.quantity) / 100);
    });
    const topSellerIds = [...sellerMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    let topSellers: Array<{ id: string; name: string; revenue: number }> = [];
    if (topSellerIds.length > 0) {
      const { data: sellerNames } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", topSellerIds.map(([id]) => id));
      const nameMap = new Map((sellerNames ?? []).map((s) => [s.id, s.full_name ?? "—"]));
      topSellers = topSellerIds.map(([id, revenue]) => ({
        id,
        name: nameMap.get(id) ?? "—",
        revenue,
      }));
    }

    // Топ-10 товаров по продажам
    const productMap = new Map<string, { id: string; title: string; qty: number; revenue: number }>();
    (itemsForTop10 ?? []).forEach((it) => {
      const key = it.product_id ?? `snap:${it.title_snapshot}`;
      const cur = productMap.get(key) ?? { id: it.product_id ?? key, title: it.title_snapshot, qty: 0, revenue: 0 };
      cur.qty += it.quantity;
      cur.revenue += (it.price_kopecks * it.quantity) / 100;
      productMap.set(key, cur);
    });
    const top10Products = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Регистрации по дням (30 дней)
    const newUsersMap = new Map<string, { date: string; count: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * day).toISOString().slice(0, 10);
      newUsersMap.set(d, { date: d, count: 0 });
    }
    (newUsersRaw ?? []).forEach((u) => {
      const key = (u.created_at as string).slice(0, 10);
      const bucket = newUsersMap.get(key);
      if (bucket) bucket.count += 1;
    });
    const newUsersChart = [...newUsersMap.values()];

    // Активные пользователи за 7 дней (уникальные buyer_id)
    const buyersWeekSet = new Set<string>();
    (ordersForRevenueSeries ?? []).forEach((o) => {
      if ((o.created_at as string) >= periods.week && o.buyer_id) buyersWeekSet.add(o.buyer_id);
    });
    const activeUsers7d = buyersWeekSet.size;

    // Средний чек по дням (30 дней)
    const avgCheckMap = new Map<string, { date: string; total: number; count: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * day).toISOString().slice(0, 10);
      avgCheckMap.set(d, { date: d, total: 0, count: 0 });
    }
    (ordersForRevenueSeries ?? []).forEach((o) => {
      const key = (o.created_at as string).slice(0, 10);
      const bucket = avgCheckMap.get(key);
      if (bucket) {
        bucket.total += (o.total_kopecks ?? 0) / 100;
        bucket.count += 1;
      }
    });
    const avgCheckChart = [...avgCheckMap.values()].map((b) => ({
      date: b.date,
      avg: b.count > 0 ? Math.round(b.total / b.count) : 0,
    }));

    // Конверсия просмотры -> заказы (за 30 дней)
    const views = viewEvents?.length ?? 0;
    const conversionOrders = ordersMonth?.length ?? 0;
    const conversion = {
      views,
      orders: conversionOrders,
      rate: views > 0 ? Math.round((conversionOrders / views) * 10000) / 100 : 0,
    };

    // Разбивка пользователей: покупатели/продавцы
    const usersSplit = {
      buyers: profilesAll?.length ?? 0,
      sellers: sellersAll?.length ?? 0,
    };

    // Топ-10 покупателей
    const buyerMap = new Map<string, number>();
    (ordersForBuyers ?? []).forEach((o) => {
      if (!o.buyer_id) return;
      buyerMap.set(o.buyer_id, (buyerMap.get(o.buyer_id) ?? 0) + (o.total_kopecks ?? 0) / 100);
    });
    const topBuyerIds = [...buyerMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    let topBuyers: Array<{ id: string; name: string; total: number }> = [];
    if (topBuyerIds.length > 0) {
      const { data: buyerNames } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", topBuyerIds.map(([id]) => id));
      const nameMap = new Map((buyerNames ?? []).map((s) => [s.id, s.full_name ?? "—"]));
      topBuyers = topBuyerIds.map(([id, total]) => ({ id, name: nameMap.get(id) ?? "—", total }));
    }

    // Проблемы с товарами
    const pendingSellerIds = [...new Set((pendingModerationProducts ?? []).map((p) => p.seller_id))];
    const { data: pendingSellerNames } = pendingSellerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", pendingSellerIds)
      : { data: [] };
    const pendingNameMap = new Map((pendingSellerNames ?? []).map((s) => [s.id, s.full_name ?? "—"]));
    const pendingModeration = (pendingModerationProducts ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      seller_name: pendingNameMap.get(p.seller_id) ?? "—",
      price_kopecks: p.price_kopecks,
      created_at: p.created_at,
    }));

    const noPhoto = (noPhotoCandidates ?? [])
      .filter((p) => !p.image_url && (!p.image_urls || p.image_urls.length === 0))
      .slice(0, 20)
      .map((p) => ({ id: p.id, title: p.title }));

    const zeroStock = (zeroStockProducts ?? []).map((p) => ({ id: p.id, title: p.title }));
    const newWeek = (newWeekProducts ?? []).map((p) => ({ id: p.id, title: p.title, created_at: p.created_at }));

    const productIssues = { pendingModeration, noPhoto, zeroStock, newWeek };

    // Динамика выручки за 90 дней
    const revenueMap = new Map<string, { date: string; revenue: number; count: number }>();
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now - i * day).toISOString().slice(0, 10);
      revenueMap.set(d, { date: d, revenue: 0, count: 0 });
    }
    (ordersForRevenueSeries ?? []).forEach((o) => {
      const key = (o.created_at as string).slice(0, 10);
      const bucket = revenueMap.get(key);
      if (bucket) {
        bucket.revenue += (o.total_kopecks ?? 0) / 100;
        bucket.count += 1;
      }
    });
    const revenueSeries = [...revenueMap.values()];

    return {
      users: {
        buyersToday: newBuyersToday?.length ?? 0,
        buyersWeek: newBuyersWeek?.length ?? 0,
        buyersMonth: newBuyersMonth?.length ?? 0,
        sellersTotal: sellersAll?.length ?? 0,
      },
      products: {
        week: productsWeek?.length ?? 0,
        month: productsMonth?.length ?? 0,
        pending: pendingProducts?.length ?? 0,
      },
      orders: {
        today: sum(ordersToday),
        week: sum(ordersWeek),
        month: sum(ordersMonth),
      },
      returns: {
        total: returnItems?.length ?? 0,
        pending: pendingReturns?.length ?? 0,
      },
      chart: [...dayMap.values()],
      topCategories,
      topSellers,
      top10Products,
      newUsersChart,
      activeUsers7d,
      avgCheckChart,
      conversion,
      usersSplit,
      topBuyers,
      productIssues,
      revenueSeries,
    };
  });
