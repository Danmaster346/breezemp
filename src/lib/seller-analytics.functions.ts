// Аналитика продавца: выручка/заказы/средний чек/топ-товары/распределение статусов
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Row = {
  order_id: string;
  product_id: string | null;
  title_snapshot: string;
  image_url: string | null;
  price_kopecks: number;
  quantity: number;
  commission_kopecks: number;
  status: string;
  orders: { created_at: string } | null;
};

const EARNED = new Set(["delivered", "received"]);
const EXCLUDE_FROM_SALES = new Set(["cancelled", "returned", "return_requested"]);

export type SellerAnalytics = ReturnType<typeof compute>;

function compute(rows: Row[]) {
  const now = Date.now();
  const startToday = new Date(new Date().toDateString()).getTime();
  const startWeek = startToday - 6 * 86400_000;
  const startMonth = startToday - 29 * 86400_000;

  // Периодические агрегаты (по заплаченному, исключаем cancelled/returned)
  const period = { today: 0, week: 0, month: 0, all: 0 };
  const orderIdsAll = new Set<string>();
  const orderIdsToday = new Set<string>();
  const orderIdsWeek = new Set<string>();
  const orderIdsMonth = new Set<string>();
  let itemsSold = 0;
  let earnedPayout = 0; // после доставки, минус комиссия

  // Топ-товары: сумма выручки и штук
  const topMap = new Map<
    string,
    { title: string; image: string | null; qty: number; revenue: number; productId: string | null }
  >();

  // Распределение по статусам (штук позиций)
  const byStatus: Record<string, number> = {};

  for (const r of rows) {
    const created = r.orders?.created_at ? new Date(r.orders.created_at).getTime() : 0;
    const line = r.price_kopecks * r.quantity;
    const status = r.status ?? "new";
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    if (EXCLUDE_FROM_SALES.has(status)) continue;

    period.all += line;
    orderIdsAll.add(r.order_id);
    itemsSold += r.quantity;
    if (created >= startToday) { period.today += line; orderIdsToday.add(r.order_id); }
    if (created >= startWeek) { period.week += line; orderIdsWeek.add(r.order_id); }
    if (created >= startMonth) { period.month += line; orderIdsMonth.add(r.order_id); }

    if (EARNED.has(status)) {
      earnedPayout += line - r.commission_kopecks;
    }

    const key = r.product_id ?? `snap:${r.title_snapshot}`;
    const cur = topMap.get(key) ?? {
      title: r.title_snapshot,
      image: r.image_url,
      qty: 0,
      revenue: 0,
      productId: r.product_id,
    };
    cur.qty += r.quantity;
    cur.revenue += line;
    topMap.set(key, cur);
  }

  const top = Array.from(topMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const avgOrder = orderIdsAll.size > 0 ? Math.round(period.all / orderIdsAll.size) : 0;

  return {
    revenue: period,
    orders: {
      all: orderIdsAll.size,
      today: orderIdsToday.size,
      week: orderIdsWeek.size,
      month: orderIdsMonth.size,
    },
    itemsSold,
    avgOrder,
    earnedPayout,
    top,
    byStatus,
    generatedAt: now,
  };
}

export const getSellerAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("order_items")
      .select(
        "order_id, product_id, title_snapshot, image_url, price_kopecks, quantity, commission_kopecks, status, orders(created_at)",
      )
      .eq("seller_id", context.userId);
    if (error) throw new Error(error.message);
    return compute((data ?? []) as unknown as Row[]);
  });
