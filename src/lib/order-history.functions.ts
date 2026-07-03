import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SellerOrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  seller_id: string;
  title_snapshot: string;
  image_url: string | null;
  price_kopecks: number;
  quantity: number;
  commission_kopecks: number;
  status: string;
  orders: {
    id: string;
    created_at: string;
    shipping_name: string | null;
    shipping_phone: string | null;
    shipping_address: string | null;
  } | null;
};

type SellerPayout = {
  id: string;
  amount_kopecks: number;
  created_at: string;
};

export const getBuyerOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .eq("buyer_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getSellerOrderItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("order_items")
      .select("*, orders(id, created_at, shipping_name, shipping_phone, shipping_address)")
      .eq("seller_id", context.userId)
      .order("id", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as SellerOrderItem[];
  });

export const getSellerFinance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .select("id, order_id, title_snapshot, image_url, price_kopecks, quantity, commission_kopecks, status, orders(created_at)")
      .eq("seller_id", context.userId)
      .order("id", { ascending: false });
    if (itemsErr) throw new Error(itemsErr.message);

    const { data: payouts, error: payoutsErr } = await supabaseAdmin
      .from("payouts")
      .select("id, amount_kopecks, created_at")
      .eq("seller_id", context.userId)
      .order("created_at", { ascending: false });
    if (payoutsErr) throw new Error(payoutsErr.message);

    const sales = (items ?? []) as SellerOrderItem[];
    const payoutRows = (payouts ?? []) as SellerPayout[];
    const totalSales = sales.reduce((s, r) => s + r.price_kopecks * r.quantity, 0);
    const totalPayout = sales.reduce(
      (s, r) => s + (r.price_kopecks * r.quantity - r.commission_kopecks),
      0,
    );
    const withdrawn = payoutRows.reduce((s, p) => s + p.amount_kopecks, 0);

    return {
      items: sales,
      payouts: payoutRows,
      totalSales,
      totalPayout,
      withdrawn,
      available: Math.max(0, totalPayout - withdrawn),
    };
  });

export const getSellerDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const productsCount = await supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", context.userId);
    if (productsCount.error) throw new Error(productsCount.error.message);

    const items = await supabaseAdmin
      .from("order_items")
      .select("order_id, price_kopecks, quantity, commission_kopecks, status, orders(created_at)")
      .eq("seller_id", context.userId);
    if (items.error) throw new Error(items.error.message);

    const rows = (items.data ?? []) as SellerOrderItem[];
    const activeItems = rows.filter(
      (r) => r.status !== "delivered" && r.status !== "received" && r.status !== "returned" && r.status !== "cancelled",
    );
    const activeOrderIds = new Set(activeItems.map((r) => r.order_id));
    const totalSales = rows.reduce((s, r) => s + r.price_kopecks * r.quantity, 0);
    const totalPayout = rows.reduce(
      (s, r) => s + (r.price_kopecks * r.quantity - r.commission_kopecks),
      0,
    );

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startWeek = startToday - 6 * 24 * 60 * 60 * 1000;
    const todayOrderIds = new Set<string>();
    const weekOrderIds = new Set<string>();
    for (const r of rows) {
      const created = r.orders?.created_at ? new Date(r.orders.created_at).getTime() : 0;
      if (created >= startToday) todayOrderIds.add(r.order_id);
      if (created >= startWeek) weekOrderIds.add(r.order_id);
    }

    return {
      products: productsCount.count ?? 0,
      active: activeOrderIds.size,
      totalSales,
      totalPayout,
      today: todayOrderIds.size,
      week: weekOrderIds.size,
    };
  });