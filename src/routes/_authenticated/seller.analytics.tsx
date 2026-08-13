// Аналитика продавца 3.0 — вкладки: Продажи, Трафик, Воронка, Отзывы, Товары.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Receipt,
  Eye,
  ShoppingCart,
  Download,
  Star,
  Layers,
  AlertTriangle,
  Percent,
  Users,
  Clock,
  CalendarDays,
  MessageSquare,
  Lightbulb,
  Loader2,
  Package,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
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
import {
  getSellerAnalyticsExtra,
  type ProductAnalyticsRow,
} from "@/lib/seller/analytics-extra.functions";
import { getSellerReviews, replyToReview } from "@/lib/seller/reviews.functions";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/_authenticated/seller/analytics")({
  head: () => ({
    meta: [
      { title: "Аналитика магазина — кабинет продавца — Kupiks" },
      {
        name: "description",
        content:
          "Продажи, трафик, воронка, отзывы и аналитика по товарам вашего магазина на Kupiks.",
      },
    ],
  }),
  component: SellerAnalyticsPage,
});

type TabKey = "sales" | "traffic" | "funnel" | "reviews" | "products";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "sales", label: "Продажи", icon: ShoppingBag },
  { key: "traffic", label: "Трафик", icon: Eye },
  { key: "funnel", label: "Воронка", icon: ShoppingCart },
  { key: "reviews", label: "Отзывы", icon: Star },
  { key: "products", label: "Товары", icon: Package },
];

const PERIODS = [
  { days: 7 as const, label: "7 дней" },
  { days: 30 as const, label: "30 дней" },
  { days: 90 as const, label: "90 дней" },
  { days: 0 as const, label: "Всё время" },
];

const PIE_COLORS = ["#0ea5a4", "#2563eb", "#f59e0b", "#a855f7", "#ef4444", "#22c55e", "#64748b"];

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-card p-4 md:p-5 shadow-sm ${className}`}>{children}</div>;
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
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-bold">{title}</h2>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous) return <span className="text-[11px] text-muted-foreground">нет данных за прошлый период</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold ${up ? "text-emerald-600" : "text-destructive"}`}
    >
      <Icon className="h-3 w-3" />
      {up ? "+" : ""}
      {pct}% к прошлому
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-1 text-xl md:text-2xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-1">{children}</div>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function ChartSkeleton({ h = 260 }: { h?: number }) {
  return <div className="animate-pulse rounded-xl bg-muted" style={{ height: h }} />;
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
        />
      ))}
    </span>
  );
}

function SellerAnalyticsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("sales");
  const [days, setDays] = useState<0 | 7 | 30 | 90>(30);

  const fetchAnalytics = useServerFn(getSellerAnalytics);
  const fetchExtra = useServerFn(getSellerAnalyticsExtra);
  const exportOrders = useServerFn(exportSellerOrdersCsv);
  const exportProducts = useServerFn(exportSellerProductsCsv);

  const base = useQuery({
    queryKey: ["seller-analytics", user?.id, days],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchAnalytics({ data: { days } }),
  });

  const extra = useQuery({
    queryKey: ["seller-analytics-extra", user?.id, days],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchExtra({ data: { days } }),
  });

  const a = base.data;
  const x = extra.data;

  const conversion = a && a.kpi.views ? Math.round((a.kpi.orders / a.kpi.views) * 1000) / 10 : 0;
  const prevConversion = a && a.prev.views ? Math.round((a.prev.orders / a.prev.views) * 1000) / 10 : 0;

  const doExport = async (kind: "orders" | "products") => {
    try {
      const res = kind === "orders" ? await exportOrders({ data: { days } }) : await exportProducts();
      downloadCsv(res.filename, res.content);
      toast.success("Файл выгружен");
    } catch (e) {
      toast.error("Не удалось выгрузить CSV", { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Аналитика магазина</h1>
          <p className="text-sm text-muted-foreground">Продажи, трафик, воронка и качество сервиса</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => doExport("orders")}
            className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-accent ui-transition"
          >
            <Download className="h-4 w-4" /> Заказы CSV
          </button>
          <button
            onClick={() => doExport("products")}
            className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-accent ui-transition"
          >
            <Download className="h-4 w-4" /> Товары CSV
          </button>
        </div>
      </div>

      {/* Вкладки */}
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
        <div className="flex min-w-max gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ui-transition ${
                  active ? "bg-brand text-brand-foreground" : "border hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Период */}
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ui-transition ${
              days === p.days ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {tab === "sales" && (
        <SalesTab
          a={a}
          x={x}
          loading={base.isLoading}
          extraLoading={extra.isLoading}
          conversion={conversion}
          prevConversion={prevConversion}
        />
      )}
      {tab === "traffic" && <TrafficTab x={x} loading={extra.isLoading} />}
      {tab === "funnel" && <FunnelTab a={a} x={x} loading={extra.isLoading} />}
      {tab === "reviews" && <ReviewsTab x={x} loading={extra.isLoading} />}
      {tab === "products" && <ProductsTab x={x} loading={extra.isLoading} />}
    </div>
  );
}

/* ================= ПРОДАЖИ ================= */

type Base = NonNullable<ReturnType<typeof useAnalyticsType>>;
function useAnalyticsType() {
  return undefined as unknown as Awaited<ReturnType<typeof getSellerAnalytics>> | undefined;
}
type Extra = Awaited<ReturnType<typeof getSellerAnalyticsExtra>> | undefined;

function SalesTab({
  a,
  x,
  loading,
  extraLoading,
  conversion,
  prevConversion,
}: {
  a: Base | undefined;
  x: Extra;
  loading: boolean;
  extraLoading: boolean;
  conversion: number;
  prevConversion: number;
}) {
  const [sort, setSort] = useState<{ key: "qty" | "revenue" | "share" | "title"; dir: 1 | -1 }>({
    key: "revenue",
    dir: -1,
  });

  const totalRevenue = a?.kpi.revenue ?? 0;
  const rows = useMemo(() => {
    const list = (a?.top ?? []).map((t) => ({
      ...t,
      share: totalRevenue ? Math.round((t.revenue / totalRevenue) * 1000) / 10 : 0,
    }));
    return list.sort((p, q) => {
      const k = sort.key;
      if (k === "title") return p.title.localeCompare(q.title) * sort.dir;
      return ((p[k] as number) - (q[k] as number)) * sort.dir;
    });
  }, [a, sort, totalRevenue]);

  const maxHour = Math.max(1, ...(x?.hourly ?? []).map((h) => h.orders));

  if (loading) return <ChartSkeleton h={320} />;
  if (!a) return <Card>Нет данных</Card>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Receipt} label="Выручка" value={formatPrice(a.kpi.revenue)}>
          <Delta current={a.kpi.revenue} previous={a.prev.revenue} />
        </Kpi>
        <Kpi icon={ShoppingBag} label="Заказов" value={String(a.kpi.orders)}>
          <Delta current={a.kpi.orders} previous={a.prev.orders} />
        </Kpi>
        <Kpi icon={Layers} label="Средний чек" value={formatPrice(a.kpi.avgOrder)}>
          <Delta current={a.kpi.avgOrder} previous={a.prev.avgOrder} />
        </Kpi>
        <Kpi icon={Percent} label="Конверсия в заказ" value={`${conversion}%`}>
          <Delta current={conversion} previous={prevConversion} />
        </Kpi>
      </div>

      <Card>
        <SectionTitle icon={TrendingUp} title="Выручка и заказы" hint={a.period.label} />
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={a.series}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 100)}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(v: number, n: string) =>
                  n === "revenue" ? [formatPrice(v), "Выручка"] : [v, "Заказы"]
                }
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                stroke="#2563eb"
                fill="url(#revGrad)"
                strokeWidth={2}
              />
              <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Package} title="Продажи по товарам" hint="кликните по заголовку для сортировки" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Товар</th>
                {(
                  [
                    ["qty", "Продано"],
                    ["revenue", "Выручка"],
                    ["share", "Доля"],
                  ] as const
                ).map(([key, label]) => (
                  <th
                    key={key}
                    className="cursor-pointer py-2 text-right hover:text-foreground"
                    onClick={() =>
                      setSort((s) => ({ key, dir: s.key === key && s.dir === -1 ? 1 : -1 }))
                    }
                  >
                    {label}
                    {sort.key === key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
                  </th>
                ))}
                <th className="py-2 text-right">Просмотры</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.productId ?? t.title} className="border-t">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {t.image ? (
                        <img src={t.image} alt="" className="h-9 w-9 rounded-lg object-cover" loading="lazy" />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-muted" />
                      )}
                      {t.productId ? (
                        <Link to="/product/$id" params={{ id: t.productId }} className="hover:underline">
                          {t.title}
                        </Link>
                      ) : (
                        t.title
                      )}
                    </div>
                  </td>
                  <td className="py-2 text-right">{t.qty}</td>
                  <td className="py-2 text-right font-semibold">{formatPrice(t.revenue)}</td>
                  <td className="py-2 text-right">{t.share}%</td>
                  <td className="py-2 text-right text-muted-foreground">{t.views}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Продаж за период не было
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={Layers} title="Продажи по категориям" />
          {a.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных</p>
          ) : (
            <>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={a.categories} dataKey="revenue" nameKey="name" innerRadius={50} outerRadius={85}>
                      {a.categories.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatPrice(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {a.categories.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="font-semibold">{formatPrice(c.revenue)}</span>
                    <span className="w-10 text-right text-muted-foreground">{c.share}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <SectionTitle icon={CalendarDays} title="Продажи по дням недели" />
          {extraLoading || !x ? (
            <ChartSkeleton h={220} />
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={x.weekday}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 100)}`} />
                  <Tooltip formatter={(v: number) => formatPrice(v)} />
                  <Bar dataKey="revenue" fill="#0ea5a4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle icon={Clock} title="Продажи по времени суток" hint="интенсивность = число заказов" />
        {extraLoading || !x ? (
          <ChartSkeleton h={80} />
        ) : (
          <div className="grid grid-cols-12 gap-1 md:grid-cols-24">
            {x.hourly.map((h) => {
              const intensity = h.orders / maxHour;
              return (
                <div key={h.hour} className="text-center">
                  <div
                    title={`${h.hour}:00 — ${h.orders} заказов, ${formatPrice(h.revenue)}`}
                    className="h-10 rounded-md border"
                    style={{ background: `rgba(14,165,164,${0.08 + intensity * 0.85})` }}
                  />
                  <div className="mt-1 text-[10px] text-muted-foreground">{h.hour}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ================= ТРАФИК ================= */

function TrafficTab({ x, loading }: { x: Extra; loading: boolean }) {
  if (loading) return <ChartSkeleton h={320} />;
  if (!x) return <Card>Нет данных</Card>;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Eye} label="Просмотры карточек" value={String(x.traffic.totalViews)} />
        <Kpi icon={Users} label="Уникальных посетителей" value={String(x.traffic.totalVisitors)} />
        <Kpi
          icon={ShoppingCart}
          label="Добавлений в корзину"
          value={String(x.traffic.byDay.reduce((s, d) => s + d.addToCart, 0))}
        />
        <Kpi
          icon={Percent}
          label="Просмотров на посетителя"
          value={
            x.traffic.totalVisitors
              ? String(Math.round((x.traffic.totalViews / x.traffic.totalVisitors) * 10) / 10)
              : "0"
          }
        />
      </div>

      <Card>
        <SectionTitle icon={Eye} title="Просмотры и посетители по дням" />
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={x.traffic.byDay}>
              <defs>
                <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5a4" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0ea5a4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="views" name="Просмотры" stroke="#0ea5a4" fill="url(#viewGrad)" />
              <Line type="monotone" dataKey="visitors" name="Посетители" stroke="#2563eb" dot={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={Layers} title="Источники трафика" hint="оценка по данным каталога" />
          <ul className="space-y-2">
            {x.traffic.sources.map((s, i) => (
              <li key={s.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{s.name}</span>
                  <span className="font-semibold">{s.share}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${s.share}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle icon={Package} title="Самые просматриваемые товары" />
          <ul className="space-y-2 text-sm">
            {[...x.products]
              .sort((a, b) => b.views - a.views)
              .slice(0, 8)
              .map((p) => (
                <li key={p.productId} className="flex items-center gap-2">
                  {p.image ? (
                    <img src={p.image} alt="" className="h-8 w-8 rounded-lg object-cover" loading="lazy" />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-muted" />
                  )}
                  <span className="flex-1 truncate">{p.title}</span>
                  <span className="text-muted-foreground">{p.views} просм.</span>
                </li>
              ))}
            {x.products.length === 0 && <li className="text-muted-foreground">Пока нет данных</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ================= ВОРОНКА ================= */

function FunnelTab({ a, x, loading }: { a: Base | undefined; x: Extra; loading: boolean }) {
  if (loading || !x || !a) return <ChartSkeleton h={320} />;

  const steps = [
    { icon: "👁️", label: "Просмотры карточки", value: a.funnel.views },
    { icon: "🛒", label: "Добавления в корзину", value: a.funnel.addToCart },
    { icon: "💳", label: "Оформления заказа", value: a.funnel.ordered },
    { icon: "✅", label: "Доставлено", value: a.funnel.delivered },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));

  const viewToCart = a.funnel.views ? Math.round((a.funnel.addToCart / a.funnel.views) * 100) : 0;
  const cartToOrder = a.funnel.addToCart ? Math.round((a.funnel.ordered / a.funnel.addToCart) * 100) : 0;

  const tips: string[] = [];
  if (a.funnel.views > 30 && viewToCart < 20)
    tips.push("Низкая конверсия «просмотр → корзина». Улучшите главное фото и заголовок карточки.");
  if (a.funnel.addToCart > 10 && cartToOrder < 40)
    tips.push("Много отказов на оформлении. Проверьте стоимость доставки и наличие товара.");
  if (a.funnel.ordered > 0 && a.funnel.delivered / Math.max(1, a.funnel.ordered) < 0.7)
    tips.push("Часть заказов не доходит до статуса «Доставлен» — ускорьте сборку и отправку.");
  if (tips.length === 0) tips.push("Воронка в норме. Наращивайте трафик: добавьте новые товары и акции.");

  return (
    <div className="space-y-5">
      <Card>
        <SectionTitle icon={ShoppingCart} title="Воронка продаж" hint={a.period.label} />
        <div className="space-y-3">
          {steps.map((s, i) => {
            const prev = i > 0 ? steps[i - 1]!.value : null;
            const pct = prev ? Math.round((s.value / Math.max(1, prev)) * 100) : null;
            return (
              <div key={s.label}>
                {pct !== null && <div className="mb-1 text-[11px] text-muted-foreground">↓ {pct}%</div>}
                <div className="flex items-center gap-3">
                  <span className="w-6 text-lg">{s.icon}</span>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{s.label}</span>
                      <span className="font-bold">{s.value}</span>
                    </div>
                    <div className="h-3 rounded-full bg-muted">
                      <div
                        className="h-3 rounded-full bg-brand"
                        style={{ width: `${Math.max(4, (s.value / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Lightbulb} title="Рекомендации" />
        <ul className="space-y-2 text-sm">
          {tips.map((t) => (
            <li key={t} className="rounded-xl bg-amber-50 p-3 text-amber-900">
              💡 {t}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle icon={Package} title="Воронка по товарам" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Товар</th>
                <th className="py-2 text-right">Просмотры</th>
                <th className="py-2 text-right">В корзину</th>
                <th className="py-2 text-right">Заказы</th>
                <th className="py-2 text-right">Доставлено</th>
                <th className="py-2 text-right">Конверсия</th>
              </tr>
            </thead>
            <tbody>
              {x.funnelByProduct.map((p) => (
                <tr key={p.productId} className="border-t">
                  <td className="py-2">
                    <Link to="/product/$id" params={{ id: p.productId }} className="hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{p.views}</td>
                  <td className="py-2 text-right">{p.addToCart}</td>
                  <td className="py-2 text-right">{p.orders}</td>
                  <td className="py-2 text-right">{p.delivered}</td>
                  <td className="py-2 text-right font-semibold">
                    {p.views ? Math.round((p.orders / p.views) * 1000) / 10 : 0}%
                  </td>
                </tr>
              ))}
              {x.funnelByProduct.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    Пока нет данных по товарам
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ================= ОТЗЫВЫ ================= */

type ReviewFilter = "all" | "unanswered" | "5" | "4" | "3" | "low" | "photo";

function ReviewsTab({ x, loading }: { x: Extra; loading: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchReviews = useServerFn(getSellerReviews);
  const sendReply = useServerFn(replyToReview);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const reviews = useQuery({
    queryKey: ["seller-reviews", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchReviews(),
  });

  const list = (reviews.data ?? []).filter((r) => {
    if (filter === "unanswered") return !r.seller_reply;
    if (filter === "5") return r.rating === 5;
    if (filter === "4") return r.rating === 4;
    if (filter === "3") return r.rating === 3;
    if (filter === "low") return r.rating <= 2;
    if (filter === "photo") return (r.photos ?? []).length > 0;
    return true;
  });

  const submit = async (id: string) => {
    if (text.trim().length < 2) return;
    setBusy(true);
    try {
      await sendReply({ data: { review_id: id, reply: text.trim() } });
      toast.success("Ответ опубликован");
      setOpenFor(null);
      setText("");
      qc.invalidateQueries({ queryKey: ["seller-reviews", user?.id] });
      qc.invalidateQueries({ queryKey: ["seller-analytics-extra", user?.id] });
    } catch (e) {
      toast.error("Не удалось ответить", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !x) return <ChartSkeleton h={320} />;

  const filters: { key: ReviewFilter; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "unanswered", label: "Без ответа" },
    { key: "5", label: "5★" },
    { key: "4", label: "4★" },
    { key: "3", label: "3★" },
    { key: "low", label: "1–2★" },
    { key: "photo", label: "С фото" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Star} label="Средний рейтинг" value={x.reviews.avg ? `${x.reviews.avg}` : "—"} />
        <Kpi icon={MessageSquare} label="Всего отзывов" value={String(x.reviews.total)} />
        <Kpi icon={Percent} label="Положительных (4–5★)" value={`${x.reviews.positivePct}%`} />
        <Kpi icon={AlertTriangle} label="Без ответа" value={String(x.reviews.unanswered)} />
      </div>

      <Card>
        <SectionTitle icon={Star} title="Распределение оценок" />
        <ul className="space-y-2">
          {x.reviews.dist.map((d) => (
            <li key={d.stars} className="flex items-center gap-3 text-sm">
              <span className="w-8 font-semibold">{d.stars}★</span>
              <div className="h-3 flex-1 rounded-full bg-muted">
                <div className="h-3 rounded-full bg-amber-400" style={{ width: `${d.share}%` }} />
              </div>
              <span className="w-16 text-right text-muted-foreground">
                {d.count} · {d.share}%
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {x.reviews.words.length > 0 && (
        <Card>
          <SectionTitle icon={MessageSquare} title="Частые слова в отзывах" />
          <div className="flex flex-wrap gap-2">
            {x.reviews.words.map((w) => (
              <span
                key={w.word}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  w.tone === "good" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                }`}
                style={{ fontSize: `${11 + Math.min(6, w.count)}px` }}
              >
                {w.word} · {w.count}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle icon={MessageSquare} title="Отзывы покупателей" />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ui-transition ${
                filter === f.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {reviews.isLoading ? (
          <TableSkeleton />
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Отзывов не найдено</p>
        ) : (
          <ul className="space-y-3">
            {list.map((r) => (
              <li key={r.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-bold">
                    {(r.author_name ?? "П").slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold">{r.author_name ?? "Покупатель"}</span>
                  <Stars value={r.rating} />
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{r.product_title}</div>
                {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                {(r.photos ?? []).length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {r.photos.map((p) => (
                      <img key={p} src={p} alt="" className="h-16 w-16 rounded-lg object-cover" loading="lazy" />
                    ))}
                  </div>
                )}
                {r.seller_reply ? (
                  <div className="mt-2 rounded-lg bg-muted p-2 text-sm">
                    <span className="font-semibold">Ответ магазина: </span>
                    {r.seller_reply}
                  </div>
                ) : openFor === r.id ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      className="w-full rounded-xl border p-2 text-sm"
                      placeholder="Ваш ответ покупателю"
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={busy}
                        onClick={() => submit(r.id)}
                        className="inline-flex h-9 items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground disabled:opacity-60"
                      >
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} Опубликовать
                      </button>
                      <button
                        onClick={() => setOpenFor(null)}
                        className="h-9 rounded-full border px-4 text-sm font-semibold hover:bg-accent"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setOpenFor(r.id);
                      setText("");
                    }}
                    className="mt-2 h-9 rounded-full border px-4 text-sm font-semibold hover:bg-accent"
                  >
                    Ответить
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ================= ТОВАРЫ ================= */

type ProductSortKey = keyof Pick<
  ProductAnalyticsRow,
  "views" | "addToCart" | "orders" | "conversion" | "revenue" | "trend"
>;

function ProductsTab({ x, loading }: { x: Extra; loading: boolean }) {
  const [sort, setSort] = useState<{ key: ProductSortKey; dir: 1 | -1 }>({ key: "revenue", dir: -1 });

  const rows = useMemo(() => {
    const list = [...(x?.products ?? [])];
    return list.sort((a, b) => (a[sort.key] - b[sort.key]) * sort.dir);
  }, [x, sort]);

  const exportCsv = () => {
    const head = ["Товар", "Просмотры", "В корзину", "Заказы", "Конверсия %", "Выручка ₽", "Рейтинг", "Тренд %"];
    const body = rows.map((p) => [
      p.title,
      p.views,
      p.addToCart,
      p.orders,
      p.conversion,
      p.revenue / 100,
      p.rating ?? "",
      p.trend,
    ]);
    const content =
      "\uFEFF" + [head, ...body].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    downloadCsv(`products-analytics-${new Date().toISOString().slice(0, 10)}.csv`, content);
    toast.success("Файл выгружен");
  };

  if (loading || !x) return <ChartSkeleton h={320} />;

  const cols: [ProductSortKey, string][] = [
    ["views", "Просмотры"],
    ["addToCart", "В корзину"],
    ["orders", "Заказов"],
    ["conversion", "Конверсия"],
    ["revenue", "Выручка"],
    ["trend", "Тренд"],
  ];

  const toneStyles = {
    bad: "bg-rose-50 text-rose-800",
    warn: "bg-amber-50 text-amber-900",
    good: "bg-emerald-50 text-emerald-800",
  } as const;
  const toneTitle = { bad: "🔴 Требуют внимания", warn: "🟡 Можно улучшить", good: "🟢 Лидеры продаж" } as const;

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={Package} title="Аналитика по товарам" />
          <button
            onClick={exportCsv}
            className="inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Экспорт CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Товар</th>
                {cols.map(([key, label]) => (
                  <th
                    key={key}
                    className="cursor-pointer py-2 text-right hover:text-foreground"
                    onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === -1 ? 1 : -1 }))}
                  >
                    {label}
                    {sort.key === key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
                  </th>
                ))}
                <th className="py-2 text-right">Рейтинг</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.productId} className="border-t">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {p.image ? (
                        <img src={p.image} alt="" className="h-9 w-9 rounded-lg object-cover" loading="lazy" />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-muted" />
                      )}
                      <Link to="/product/$id" params={{ id: p.productId! }} className="hover:underline">
                        {p.title}
                      </Link>
                    </div>
                  </td>
                  <td className="py-2 text-right">{p.views}</td>
                  <td className="py-2 text-right">{p.addToCart}</td>
                  <td className="py-2 text-right">{p.orders}</td>
                  <td className="py-2 text-right">{p.conversion}%</td>
                  <td className="py-2 text-right font-semibold">{formatPrice(p.revenue)}</td>
                  <td
                    className={`py-2 text-right font-semibold ${
                      p.trend > 0 ? "text-emerald-600" : p.trend < 0 ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {p.trend > 0 ? "+" : ""}
                    {p.trend}%
                  </td>
                  <td className="py-2 text-right">{p.rating ? `${p.rating}★` : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    Товаров пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Lightbulb} title="Умные рекомендации" />
        {x.recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нечего рекомендовать — мало данных.</p>
        ) : (
          <ul className="space-y-2">
            {(["bad", "warn", "good"] as const).map((tone) => {
              const items = x.recommendations.filter((r) => r.tone === tone);
              if (items.length === 0) return null;
              return (
                <li key={tone}>
                  <div className="mb-1 text-xs font-bold">{toneTitle[tone]}</div>
                  <ul className="space-y-1.5">
                    {items.map((r, i) => (
                      <li key={`${tone}-${i}`} className={`rounded-xl p-3 text-sm ${toneStyles[tone]}`}>
                        <span className="font-semibold">{r.title}</span> — {r.text}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
