// Аналитика продавца: выручка, заказы, топ-товары, распределение статусов
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  TrendingUp,
  ShoppingBag,
  Package,
  Receipt,
  Trophy,
  BarChart3,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import { getSellerAnalytics } from "@/lib/seller-analytics.functions";
import { STATUS_LABELS, STATUS_BADGE, ALL_STATUSES, type OrderStatus } from "@/lib/order-status";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/seller/analytics")({
  head: () => ({ meta: [{ title: "Аналитика — продавец — BreezeMarket" }] }),
  component: SellerAnalyticsPage,
});

function SellerAnalyticsPage() {
  const { user } = useAuth();
  const fetch = useServerFn(getSellerAnalytics);
  const q = useQuery({
    queryKey: ["seller-analytics", user?.id],
    enabled: !!user,
    queryFn: () => fetch(),
  });

  if (q.isLoading) {
    return <div className="text-muted-foreground">Загрузка аналитики…</div>;
  }
  if (q.isError || !q.data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Не удалось загрузить аналитику.
      </div>
    );
  }
  const a = q.data;
  const maxStatus = Math.max(1, ...Object.values(a.byStatus));

  const primary = [
    { label: "Выручка (всего)", value: formatPrice(a.revenue.all), icon: TrendingUp, accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-700" },
    { label: "Заказов", value: String(a.orders.all), icon: ShoppingBag, accent: "from-sky-500/15 to-sky-500/5 text-sky-700" },
    { label: "Средний чек", value: formatPrice(a.avgOrder), icon: Receipt, accent: "from-indigo-500/15 to-indigo-500/5 text-indigo-700" },
    { label: "Товаров продано", value: String(a.itemsSold), icon: Package, accent: "from-amber-500/15 to-amber-500/5 text-amber-700" },
  ];

  const periods = [
    { label: "Сегодня", revenue: a.revenue.today, orders: a.orders.today },
    { label: "За неделю", revenue: a.revenue.week, orders: a.orders.week },
    { label: "За месяц", revenue: a.revenue.month, orders: a.orders.month },
    { label: "За всё время", revenue: a.revenue.all, orders: a.orders.all },
  ];

  return (
    <div className="space-y-6">
      {/* Основные KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {primary.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`relative rounded-2xl border bg-gradient-to-br ${c.accent} p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className="mt-1 text-xl md:text-2xl font-bold text-foreground break-words">{c.value}</div>
                </div>
                <div className="rounded-xl bg-background/60 p-2 shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Периоды */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand" />
          <h2 className="font-semibold">Выручка по периодам</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
          {periods.map((p) => (
            <div key={p.label} className="p-5">
              <div className="text-xs text-muted-foreground">{p.label}</div>
              <div className="mt-1 text-lg md:text-xl font-bold">{formatPrice(p.revenue)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">заказов: {p.orders}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Топ-5 товаров */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h2 className="font-semibold">Топ-5 товаров</h2>
        </div>
        {a.top.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Пока нет продаж — топ появится после первых заказов.
          </div>
        ) : (
          <ul className="divide-y">
            {a.top.map((t, i) => {
              const inner = (
                <>
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800 text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-surface overflow-hidden shrink-0">
                    {t.image ? (
                      <img src={t.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-lg">🛍️</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium line-clamp-1">{t.title}</div>
                    <div className="text-xs text-muted-foreground">Продано: {t.qty} шт.</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold">{formatPrice(t.revenue)}</div>
                    <div className="text-[11px] text-muted-foreground">выручка</div>
                  </div>
                </>
              );
              return (
                <li key={i} className="px-5 py-3">
                  {t.productId ? (
                    <Link
                      to="/product/$id"
                      params={{ id: t.productId }}
                      className="flex items-center gap-3 hover:opacity-80 transition"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Распределение по статусам */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold">Заказы по статусам</h2>
        </div>
        <div className="p-5 space-y-3">
          {ALL_STATUSES.map((s) => {
            const n = a.byStatus[s] ?? 0;
            const w = Math.round((n / maxStatus) * 100);
            return (
              <div key={s} className="flex items-center gap-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium shrink-0 w-28 text-center ${STATUS_BADGE[s as OrderStatus]}`}>
                  {STATUS_LABELS[s as OrderStatus]}
                </span>
                <div className="flex-1 h-2 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-brand transition-all"
                    style={{ width: n > 0 ? `${Math.max(6, w)}%` : "0%" }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-semibold tabular-nums">{n}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
