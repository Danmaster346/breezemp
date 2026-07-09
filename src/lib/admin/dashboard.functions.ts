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
    };
  });
