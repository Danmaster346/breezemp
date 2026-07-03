// Обёртка кабинета продавца: дашборд статистики + вкладки товаров/заказов
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import { getSellerDashboardStats } from "@/lib/order-history.functions";
import {
  Package,
  ClipboardList,
  Plus,
  Boxes,
  Truck,
  Wallet,
  CalendarDays,
  Banknote,
  BarChart3,
  MessageCircle,
} from "lucide-react";

// Маршрут «/seller» — обёртка с дашбордом и вкладками
export const Route = createFileRoute("/_authenticated/seller")({
  component: SellerLayout,
});

// Описание вкладок кабинета
const tabs = [
  { to: "/seller/products", label: "Мои товары", icon: Package },
  { to: "/seller/orders", label: "Заказы", icon: ClipboardList },
  { to: "/seller/analytics", label: "Аналитика", icon: BarChart3 },
  { to: "/seller/balance", label: "Финансы", icon: Banknote },
  { to: "/messages", label: "Сообщения", icon: MessageCircle },
] as const;


// Компонент обёртки
function SellerLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchStats = useServerFn(getSellerDashboardStats);
  // Активная вкладка — по текущему URL
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  // Считаем статистику для дашборда одним запросом
  const stats = useQuery({
    queryKey: ["seller-stats", user?.id],
    enabled: !!user,
    queryFn: () => fetchStats(),
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
      label: "Сумма продаж",
      value: stats.data ? formatPrice(stats.data.totalSales) : "—",
      hint: "заплатили покупатели",
      icon: Wallet,
      accent: "from-sky-500/15 to-sky-500/5 text-sky-600",
    },
    {
      label: "К получению",
      value: stats.data ? formatPrice(stats.data.totalPayout) : "—",
      hint: "после комиссии 10%",
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
