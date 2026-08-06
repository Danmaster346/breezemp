// Кабинет продавца — тёмная тема, боковой сайдбар, компактный дашборд.
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SellerSidebar, SellerTabs, useForceSellerMode } from "@/components/SellerSidebar";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import { getSellerDashboardStats } from "@/lib/order-history.functions";
import { getSellerTasks } from "@/lib/seller/tasks.functions";
import {
  Plus,
  Boxes,
  Truck,
  Wallet,
  CalendarDays,
  AlertTriangle,
  MessageSquare,
  PackageCheck,
  RotateCcw,
  Star,
  BarChart3,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/seller")({
  component: SellerLayout,
});

function SellerLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchStats = useServerFn(getSellerDashboardStats);
  useForceSellerMode();

  const stats = useQuery({
    queryKey: ["seller-stats", user?.id],
    enabled: !!user,
    queryFn: () => fetchStats(),
  });

  const cards = [
    {
      label: "Всего товаров",
      value: stats.data ? String(stats.data.products) : "—",
      icon: Boxes,
    },
    {
      label: "Активные заказы",
      value: stats.data ? String(stats.data.active) : "—",
      icon: Truck,
    },
    {
      label: "Сумма продаж",
      value: stats.data ? formatPrice(stats.data.totalSales) : "—",
      hint: "заплатили покупатели",
      icon: Wallet,
    },
    {
      label: "К получению",
      value: stats.data ? formatPrice(stats.data.totalPayout) : "—",
      hint: "после комиссии 10%",
      icon: Wallet,
    },
    {
      label: "Заказов за неделю",
      value: stats.data ? String(stats.data.week) : "—",
      hint: stats.data ? `сегодня: ${stats.data.today}` : undefined,
      icon: CalendarDays,
    },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Breadcrumbs items={[{ label: "Кабинет продавца" }]} className="mb-4" />

        <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
          <SellerSidebar />

          <div className="min-w-0">
            <SellerTabs />

            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">
                  Кабинет продавца
                </h1>
                <p className="text-sm text-muted-foreground">Товары, заказы и общая статистика</p>
              </div>
              <button
                onClick={() =>
                  navigate({ to: "/seller/products", search: { new: 1 } })
                }
                className="inline-flex items-center gap-2 h-11 px-4 rounded-full bg-brand text-brand-foreground text-sm font-semibold hover:opacity-90 ui-transition"
              >
                <Plus className="h-4 w-4" strokeWidth={2.25} /> Новый товар
              </button>
            </div>

            {/* Дашборд KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
              {cards.map((c) => {
                const Icon = c.icon;
                return (
                  <div
                    key={c.label}
                    className="rounded-2xl bg-card hairline p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          {c.label}
                        </div>
                        <div className="mt-2 font-display text-xl md:text-2xl font-extrabold text-foreground break-words">
                          {c.value}
                        </div>
                        {c.hint && (
                          <div className="text-xs text-muted-foreground mt-1">{c.hint}</div>
                        )}
                      </div>
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-surface shrink-0">
                        <Icon className="h-4 w-4 text-foreground/70" strokeWidth={1.75} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Outlet />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
