// Обёртка кабинета продавца: дашборд статистики + вкладки товаров/заказов
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import {
  Package,
  ClipboardList,
  Plus,
  Boxes,
  Truck,
  Wallet,
  CalendarDays,
} from "lucide-react";

// Маршрут «/seller» — обёртка с дашбордом и вкладками
export const Route = createFileRoute("/_authenticated/seller")({
  component: SellerLayout,
});

// Описание вкладок кабинета
const tabs = [
  { to: "/seller/products", label: "Мои товары", icon: Package },
  { to: "/seller/orders", label: "Заказы", icon: ClipboardList },
] as const;

// Компонент обёртки
function SellerLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Активная вкладка — по текущему URL
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  // Считаем статистику для дашборда одним запросом
  const stats = useQuery({
    queryKey: ["seller-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Количество товаров продавца
      const productsCount = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user!.id);

      // Все позиции заказов этого продавца — из них считаем остальное
      const items = await supabase
        .from("order_items")
        .select("order_id, price_kopecks, quantity, commission_kopecks, status, orders(created_at)")
        .eq("seller_id", user!.id);
      if (items.error) throw items.error;

      const rows = items.data ?? [];
      // Активные заказы = позиции в работе (не доставлены и не отменены)
      const activeItems = rows.filter(
        (r) => r.status !== "delivered" && r.status !== "cancelled",
      );
      const activeOrderIds = new Set(activeItems.map((r) => r.order_id));
      // Общая выручка продавца за всё время (за вычетом комиссии платформы)
      const totalPayout = rows.reduce(
        (s, r) => s + (r.price_kopecks * r.quantity - r.commission_kopecks),
        0,
      );
      // Диапазоны для «сегодня» и «за неделю»
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
        totalPayout,
        today: todayOrderIds.size,
        week: weekOrderIds.size,
      };
    },
  });

  // Карточки статистики (данные могут ещё грузиться → показываем «—»)
  const cards = [
    {
      label: "Всего товаров",
      value: stats.data ? String(stats.data.products) : "—",
      icon: Boxes,
      accent: "from-primary/15 to-primary/5 text-primary",
    },
    {
      label: "Активные заказы",
      value: stats.data ? String(stats.data.active) : "—",
      icon: Truck,
      accent: "from-amber-500/15 to-amber-500/5 text-amber-600",
    },
    {
      label: "Продажи за всё время",
      value: stats.data ? formatPrice(stats.data.totalPayout) : "—",
      icon: Wallet,
      accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    },
    {
      label: "Заказов за неделю",
      value: stats.data ? String(stats.data.week) : "—",
      hint: stats.data ? `сегодня: ${stats.data.today}` : undefined,
      icon: CalendarDays,
      accent: "from-indigo-500/15 to-indigo-500/5 text-indigo-600",
    },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Заголовок и кнопка добавления товара */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Кабинет продавца</h1>
            <p className="text-sm text-muted-foreground">Товары, заказы и общая статистика</p>
          </div>
          <button
            onClick={() =>
              navigate({ to: "/seller/products", search: { new: 1 } })
            }
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Добавить новый товар
          </button>
        </div>

        {/* Дашборд */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.label}
                className={`relative rounded-2xl border bg-gradient-to-br ${c.accent} p-4 overflow-hidden`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{c.label}</div>
                    <div className="mt-1 text-xl md:text-2xl font-bold text-foreground break-words">
                      {c.value}
                    </div>
                    {c.hint && (
                      <div className="text-xs text-muted-foreground mt-0.5">{c.hint}</div>
                    )}
                  </div>
                  <div className="rounded-xl bg-background/60 p-2 shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Вкладки */}
        <div className="flex gap-1 mb-6 border-b overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = pathname === t.to;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`inline-flex items-center gap-2 px-4 py-2.5 border-b-2 -mb-px text-sm font-medium whitespace-nowrap ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </Link>
            );
          })}
        </div>

        {/* Слот подмаршрутов */}
        <Outlet />
      </div>
    </AppLayout>
  );
}
