// Аналитика продавца 2.0: периоды со сравнением, графики выручки и просмотров,
// воронка, топ и «залежавшиеся» товары, категории, доставка, качество, экспорт CSV.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Package,
  Receipt,
  Trophy,
  Eye,
  ShoppingCart,
  Download,
  Star,
  Truck,
  MapPin,
  Layers,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import {
  getSellerAnalytics,
  exportSellerOrdersCsv,
  exportSellerProductsCsv,
} from "@/lib/seller-analytics.functions";
import { STATUS_LABELS, STATUS_BADGE, type OrderStatus } from "@/lib/order-status";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/seller/analytics")({
  head: () => ({
    meta: [
      { title: "Аналитика магазина — кабинет продавца — BreezeMarket" },
      {
        name: "description",
        content:
          "Выручка, заказы, средний чек, воронка продаж, топ-товары и качество сервиса вашего магазина на BreezeMarket.",
      },
    ],
  }),
  component: SellerAnalyticsPage,
});

const PERIODS = [
  { days: 7 as const, label: "7 дней" },
  { days: 30 as const, label: "30 дней" },
  { days: 90 as const, label: "90 дней" },
  { days: 0 as const, label: "Всё время" },
];

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous) {
    return <span className="text-[11px] text-muted-foreground">нет данных за прошлый период</span>;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${up ? "text-emerald-600" : "text-destructive"}`}
    >
      <Icon className="h-3 w-3" />
      {up ? "+" : ""}
      {pct}% к прошлому периоду
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border bg-card p-4 md:p-5 shadow-sm ${className}`}>{children}</div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ElementType;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-bold">{title}</h2>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function SellerAnalyticsPage() {
  const { user } = useAuth();
  const [days, setDays] = useState<0 | 7 | 30 | 90>(30);
  const [busy, setBusy] = useState(false);

  const fetchAnalytics = useServerFn(getSellerAnalytics);
  const fetchOrdersCsv = useServerFn(exportSellerOrdersCsv);
  const fetchProductsCsv = useServerFn(exportSellerProductsCsv);

  const q = useQuery({
    queryKey: ["seller-analytics", user?.id, days],
    enabled: !!user,
    queryFn: () => fetchAnalytics({ data: { days } }),
  });

  const exportOrders = async () => {
    setBusy(true);
    try {
      const r = await fetchOrdersCsv({ data: { days } });
      downloadCsv(r.filename, r.content);
      toast.success("Отчёт по заказам скачан");
    } catch {
      toast.error("Не удалось выгрузить отчёт");
    } finally {
      setBusy(false);
    }
  };

  const exportProducts = async () => {
    setBusy(true);
    try {
      const r = await fetchProductsCsv();
      downloadCsv(r.filename, r.content);
      toast.success("Список товаров скачан");
    } catch {
      toast.error("Не удалось выгрузить товары");
    } finally {
      setBusy(false);
    }
  };

  const periodSwitch = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl border bg-muted/40 p-1">
        {PERIODS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setDays(p.days)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              days === p.days ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={exportOrders}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" /> Заказы CSV
      </button>
      <button
        type="button"
        onClick={exportProducts}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" /> Товары CSV
      </button>
    </div>
  );

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        {periodSwitch}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="space-y-4">
        {periodSwitch}
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Не удалось загрузить аналитику. Попробуйте обновить страницу.
        </div>
      </div>
    );
  }

  const a = q.data;
  const conv = a.funnel.views ? Math.round((a.funnel.ordered / a.funnel.views) * 1000) / 10 : 0;

  const kpi = [
    {
      label: "Выручка",
      value: formatPrice(a.kpi.revenue),
      icon: TrendingUp,
      accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-700",
      delta: <Delta current={a.kpi.revenue} previous={a.prev.revenue} />,
    },
    {
      label: "Заказов",
      value: String(a.kpi.orders),
      icon: ShoppingBag,
      accent: "from-sky-500/15 to-sky-500/5 text-sky-700",
      delta: <Delta current={a.kpi.orders} previous={a.prev.orders} />,
    },
    {
      label: "Средний чек",
      value: formatPrice(a.kpi.avgOrder),
      icon: Receipt,
      accent: "from-indigo-500/15 to-indigo-500/5 text-indigo-700",
      delta: <Delta current={a.kpi.avgOrder} previous={a.prev.avgOrder} />,
    },
    {
      label: "Товаров продано",
      value: String(a.kpi.itemsSold),
      icon: Package,
      accent: "from-amber-500/15 to-amber-500/5 text-amber-700",
      delta: <Delta current={a.kpi.itemsSold} previous={a.prev.itemsSold} />,
    },
  ];

  const secondary = [
    { label: "Просмотры карточек", value: String(a.kpi.views), icon: Eye },
    { label: "Добавили в корзину", value: String(a.kpi.addToCart), icon: ShoppingCart },
    { label: "Конверсия в заказ", value: `${conv}%`, icon: TrendingUp },
    { label: "Заработано (к выводу)", value: formatPrice(a.kpi.earnedPayout), icon: Wallet },
  ];

  const funnelSteps = [
    { label: "Просмотры", value: a.funnel.views, color: "bg-sky-500" },
    { label: "В корзину", value: a.funnel.addToCart, color: "bg-indigo-500" },
    { label: "Заказано", value: a.funnel.ordered, color: "bg-amber-500" },
    { label: "Доставлено", value: a.funnel.delivered, color: "bg-emerald-500" },
  ];
  const funnelMax = Math.max(1, ...funnelSteps.map((s) => s.value));

  const statusEntries = Object.entries(a.byStatus).sort((x, y) => y[1] - x[1]);
  const statusMax = Math.max(1, ...statusEntries.map(([, v]) => v));

  const chartData = a.series.map((s) => ({ ...s, revenueRub: s.revenue / 100 }));
  const CAT_COLORS = ["#10b981", "#0ea5e9", "#6366f1", "#f59e0b", "#ef4444", "#14b8a6"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Аналитика магазина</h1>
          <p className="text-xs text-muted-foreground">Период: {a.period.label}</p>
        </div>
        {periodSwitch}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`rounded-2xl border bg-gradient-to-br ${c.accent} p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className="mt-1 text-xl md:text-2xl font-bold text-foreground break-words">
                    {c.value}
                  </div>
                </div>
                <Icon className="h-5 w-5 shrink-0 opacity-70" />
              </div>
              <div className="mt-2">{c.delta}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {secondary.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" /> {c.label}
              </div>
              <div className="mt-1 text-lg font-bold">{c.value}</div>
            </Card>
          );
        })}
      </div>

      {/* Динамика выручки */}
      {chartData.length > 1 ? (
        <Card>
          <SectionTitle icon={TrendingUp} title="Динамика выручки и заказов" hint={a.period.label} />
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} width={56} />
                <Tooltip
                  formatter={(v: number, name) =>
                    name === "revenueRub" ? [`${v.toLocaleString("ru-RU")} ₽`, "Выручка"] : [v, "Заказы"]
                  }
                  labelClassName="text-xs"
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenueRub"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#rev)"
                />
                <Line type="monotone" dataKey="orders" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Воронка */}
        <Card>
          <SectionTitle icon={Layers} title="Воронка продаж" hint={`конверсия ${conv}%`} />
          {a.funnel.views === 0 ? (
            <p className="text-xs text-muted-foreground">
              Пока нет данных о просмотрах — они появятся, когда покупатели начнут открывать ваши товары.
            </p>
          ) : (
            <div className="space-y-3">
              {funnelSteps.map((s, i) => {
                const prevVal = i === 0 ? s.value : funnelSteps[i - 1]!.value;
                const step = prevVal ? Math.round((s.value / prevVal) * 100) : 0;
                return (
                  <div key={s.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{s.label}</span>
                      <span className="text-muted-foreground">
                        {s.value}
                        {i > 0 ? ` · ${step}%` : ""}
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 rounded-full bg-muted">
                      <div
                        className={`h-2.5 rounded-full ${s.color} transition-all`}
                        style={{ width: `${Math.max(3, (s.value / funnelMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Качество сервиса */}
        <Card>
          <SectionTitle icon={Star} title="Качество сервиса" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Рейтинг магазина</div>
              <div className="mt-1 flex items-center gap-1 text-lg font-bold">
                {a.quality.rating ?? "—"}
                {a.quality.rating ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> : null}
              </div>
              <div className="text-[11px] text-muted-foreground">{a.quality.reviews} отзывов</div>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Среднее время отправки</div>
              <div className="mt-1 text-lg font-bold">
                {a.quality.avgShipHours === null ? "—" : `${a.quality.avgShipHours} ч`}
              </div>
              <div className="text-[11px] text-muted-foreground">от заказа до отправки</div>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Отмены</div>
              <div
                className={`mt-1 text-lg font-bold ${a.quality.cancelRate > 10 ? "text-destructive" : ""}`}
              >
                {a.quality.cancelRate}%
              </div>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground">Возвраты</div>
              <div
                className={`mt-1 text-lg font-bold ${a.quality.returnRate > 10 ? "text-destructive" : ""}`}
              >
                {a.quality.returnRate}%
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Топ товаров */}
      <Card>
        <SectionTitle icon={Trophy} title="Топ товаров по выручке" />
        {a.top.length === 0 ? (
          <p className="text-xs text-muted-foreground">Продаж за период пока нет.</p>
        ) : (
          <div className="space-y-2">
            {a.top.map((t, i) => (
              <div key={`${t.productId ?? t.title}-${i}`} className="flex items-center gap-3 rounded-xl border p-2.5">
                <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">
                  {i + 1}
                </span>
                {t.image ? (
                  <img
                    src={t.image}
                    alt={t.title}
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  {t.productId ? (
                    <Link
                      to="/product/$id"
                      params={{ id: t.productId }}
                      className="line-clamp-1 text-sm font-semibold hover:text-primary"
                    >
                      {t.title}
                    </Link>
                  ) : (
                    <span className="line-clamp-1 text-sm font-semibold">{t.title}</span>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    {t.qty} шт · {t.views} просмотров
                  </div>
                </div>
                <div className="shrink-0 text-sm font-bold">{formatPrice(t.revenue)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Залежавшиеся товары */}
        <Card>
          <SectionTitle icon={AlertTriangle} title="Требуют внимания" hint="нет продаж 30 дней" />
          {a.stale.length === 0 ? (
            <p className="text-xs text-muted-foreground">Все товары продаются — отличная работа.</p>
          ) : (
            <div className="space-y-2">
              {a.stale.map((s) => (
                <div key={s.productId} className="flex items-center gap-3 rounded-xl border p-2.5">
                  {s.image ? (
                    <img src={s.image} alt={s.title} loading="lazy" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-sm font-medium">{s.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.reason} · остаток {s.stock}
                    </div>
                  </div>
                  <Link
                    to="/seller/products"
                    className="shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
                  >
                    Изменить
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Категории */}
        <Card>
          <SectionTitle icon={Layers} title="Выручка по категориям" />
          {a.categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">Нет данных за период.</p>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={a.categories.map((c) => ({ ...c, rub: c.revenue / 100 }))}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={92} />
                  <Tooltip
                    formatter={(v: number) => [`${v.toLocaleString("ru-RU")} ₽`, "Выручка"]}
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  />
                  <Bar dataKey="rub" radius={[0, 6, 6, 0]}>
                    {a.categories.map((_, i) => (
                      <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Статусы */}
        <Card>
          <SectionTitle icon={Package} title="Статусы заказов" />
          {statusEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground">Нет заказов за период.</p>
          ) : (
            <div className="space-y-2">
              {statusEntries.map(([status, count]) => (
                <div key={status}>
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        STATUS_BADGE[status as OrderStatus] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {STATUS_LABELS[status as OrderStatus] ?? status}
                    </span>
                    <span className="font-semibold">{count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(count / statusMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Доставка */}
        <Card>
          <SectionTitle icon={Truck} title="Способы доставки" />
          {a.shipping.length === 0 ? (
            <p className="text-xs text-muted-foreground">Нет данных.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {a.shipping.map((s) => (
                <li key={s.method} className="flex items-center justify-between">
                  <span className="capitalize text-muted-foreground">{s.method}</span>
                  <span className="font-semibold">{s.orders}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* География */}
        <Card>
          <SectionTitle icon={MapPin} title="География заказов" />
          {a.cities.length === 0 ? (
            <p className="text-xs text-muted-foreground">Нет данных.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {a.cities.map((c) => (
                <li key={c.city} className="flex items-center justify-between">
                  <span className="truncate text-muted-foreground">{c.city}</span>
                  <span className="font-semibold">{c.orders}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
