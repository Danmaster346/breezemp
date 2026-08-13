// Главный экран кабинета продавца: приветствие, здоровье профиля, KPI-виджеты,
// задачи на сегодня, график продаж и лента активности.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  MessageSquare,
  Package,
  ShoppingBag,
  Star,
  TrendingUp,
  Trophy,
  Wallet,
  Warehouse,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useAuth } from "@/lib/use-auth";
import { usePanels } from "@/lib/panels-store";
import {
  getSellerDashboardExtra,
  getSellerSalesSeries,
  type ActivityEvent,
} from "@/lib/seller/dashboard-extra.functions";
import type { SellerDashboardSummary } from "@/lib/seller/dashboard.functions";

const STALE = 5 * 60 * 1000;

const RANGES = [
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "3m", label: "3 месяца" },
  { key: "1y", label: "Год" },
] as const;

const STATUS_META = {
  active: { dot: "🟢", label: "Активен", tone: "bg-emerald-500/10 text-emerald-700" },
  moderation: { dot: "🟡", label: "На модерации", tone: "bg-amber-500/10 text-amber-700" },
  blocked: { dot: "🔴", label: "Заблокирован", tone: "bg-destructive/10 text-destructive" },
} as const;

const ACTIVITY_ICON: Record<ActivityEvent["kind"], string> = {
  order: "📦",
  review: "⭐",
  moderation: "✅",
  message: "💬",
  payout: "💰",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  if (d === 1) return "вчера";
  return `${d} дн назад`;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-xl bg-surface animate-pulse ${className}`} />;
}

/** Мини-спарклайн выручки на SVG. */
function Spark({ data }: { data: { day: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100;
  const h = 28;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((d, i) => `${i * step},${h - (d.value / max) * (h - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-8 w-full" preserveAspectRatio="none">
      <polyline points={`0,${h} ${pts} ${w},${h}`} className="fill-brand/10" stroke="none" />
      <polyline
        points={pts}
        fill="none"
        strokeWidth="2"
        stroke="currentColor"
        className="text-brand"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-card hairline p-4 ${className}`}>{children}</div>;
}

export function SellerDashboardHome({ summary }: { summary?: SellerDashboardSummary }) {
  const { user } = useAuth();
  const openMessages = usePanels((s) => s.openMessages);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30d");

  const fetchExtra = useServerFn(getSellerDashboardExtra);
  const fetchSeries = useServerFn(getSellerSalesSeries);

  const extra = useQuery({
    queryKey: ["seller-dashboard-extra", user?.id],
    enabled: !!user,
    queryFn: () => fetchExtra(),
    staleTime: STALE,
  });

  const series = useQuery({
    queryKey: ["seller-sales-series", user?.id, range],
    enabled: !!user,
    queryFn: () => fetchSeries({ data: { range } }),
    staleTime: STALE,
  });

  const c = extra.data?.counters;
  const prof = extra.data?.profile;

  const delta = useMemo(() => {
    if (!c) return null;
    if (c.revenueYesterday === 0) return c.revenueToday > 0 ? 100 : 0;
    return Math.round(((c.revenueToday - c.revenueYesterday) / c.revenueYesterday) * 100);
  }, [c]);

  const chartData = useMemo(
    () => (series.data ?? []).map((p) => ({ ...p, rub: Math.round(p.revenue / 100) })),
    [series.data],
  );

  const tasks = c
    ? [
        { label: `Обработать новые заказы`, n: c.newOrdersToday, to: "/seller/orders", icon: ClipboardList },
        { label: "Ответить на сообщения", n: c.unread, panel: true, icon: MessageSquare },
        { label: "Товары заканчиваются", n: c.lowStock, to: "/seller/products", icon: Warehouse },
        { label: "Ожидают ответа отзывы", n: c.reviewsWaiting, to: "/seller/reviews", icon: Star },
        { label: "Товары без фото", n: c.noPhoto, to: "/seller/products", icon: Camera },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Приветствие и здоровье профиля */}
      <Card>
        {extra.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl md:text-2xl font-extrabold tracking-tight">
                Добро пожаловать, {prof?.shopName || "продавец"}! 👋
              </h2>
              {prof && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${STATUS_META[prof.status].tone}`}
                >
                  {STATUS_META[prof.status].dot} {STATUS_META[prof.status].label}
                </span>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Заполненность профиля</span>
                <span className="tabular-nums text-foreground">{prof?.completeness ?? 0}%</span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand ui-transition"
                  style={{ width: `${prof?.completeness ?? 0}%` }}
                />
              </div>
            </div>

            {prof && prof.hints.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {prof.hints.map((h) => (
                  <li
                    key={h}
                    className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      {/* Уведомления и алерты */}
      <SellerAlerts counters={c} />



      {/* KPI-виджеты */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Выручка сегодня
          </div>
          {extra.isLoading ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <div className="mt-1.5 font-display text-xl md:text-2xl font-extrabold tabular-nums">
              {formatPrice(c?.revenueToday ?? 0)}
            </div>
          )}
          {delta !== null && (
            <div
              className={`mt-1 inline-flex items-center gap-1 text-xs font-bold ${delta >= 0 ? "text-emerald-600" : "text-destructive"}`}
            >
              {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {delta > 0 ? "+" : ""}
              {delta}% к вчера
            </div>
          )}
          {summary?.spark && <Spark data={summary.spark.slice(-7)} />}
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ShoppingBag className="h-3.5 w-3.5" /> Заказы
          </div>
          {extra.isLoading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <div className="mt-1.5 font-display text-xl md:text-2xl font-extrabold tabular-nums">
              {c?.activeOrders ?? 0}
            </div>
          )}
          <div className="mt-1 text-xs text-muted-foreground">
            новых сегодня: <b className="text-foreground tabular-nums">{c?.newOrdersToday ?? 0}</b>
          </div>
          <Link
            to="/seller/orders"
            className="mt-3 inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold hover:bg-accent ui-transition"
          >
            Посмотреть
          </Link>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> Товары
          </div>
          {extra.isLoading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <div className="mt-1.5 font-display text-xl md:text-2xl font-extrabold tabular-nums">
              {c?.activeProducts ?? 0}
            </div>
          )}
          <div className="mt-1 space-y-0.5 text-xs">
            <div className="text-amber-600 font-semibold">
              на модерации: {c?.pendingProducts ?? 0}
            </div>
            <div className="text-destructive font-semibold">
              отклонено: {c?.rejectedProducts ?? 0}
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Star className="h-3.5 w-3.5" /> Рейтинг
          </div>
          {extra.isLoading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <div className="mt-1.5 font-display text-xl md:text-2xl font-extrabold tabular-nums">
              {c && c.reviewsCount > 0 ? `⭐ ${c.avgRating.toFixed(1)}` : "—"}
            </div>
          )}
          <div className="mt-1 text-xs text-muted-foreground">{c?.reviewsCount ?? 0} отзывов</div>
          {c?.rank && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-bold">
              <Trophy className="h-3.5 w-3.5 text-brand" /> {c.rank} из {c.sellersTotal}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* График продаж */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold">
              <TrendingUp className="h-4 w-4 text-brand" /> Продажи
            </div>
            <div className="flex flex-wrap gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={`h-8 rounded-full px-3 text-xs font-semibold ui-transition ${
                    range === r.key ? "bg-brand text-brand-foreground" : "border hover:bg-accent"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {series.isLoading ? (
            <Skeleton className="mt-4 h-[260px] w-full" />
          ) : (
            <div className="mt-4 h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sellerRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} width={56} />
                  <Tooltip
                    formatter={(v: number, name) =>
                      name === "rub" ? [`${v.toLocaleString("ru-RU")} ₽`, "Выручка"] : [v, "Заказов"]
                    }
                    labelFormatter={(l) => `Период: ${l}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="rub"
                    stroke="var(--brand)"
                    strokeWidth={2}
                    fill="url(#sellerRevenue)"
                  />
                  <Area type="monotone" dataKey="orders" stroke="transparent" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {/* Задачи на сегодня */}
          <Card>
            <div className="flex items-center gap-2 text-sm font-bold">
              <Clock className="h-4 w-4 text-brand" /> Задачи на сегодня
            </div>
            <ul className="mt-3 space-y-1.5">
              {extra.isLoading &&
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
              {tasks.map((t) => {
                const Icon = t.icon;
                const done = t.n === 0;
                const inner = (
                  <span className="flex w-full items-center gap-2.5">
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Icon className="h-4 w-4 shrink-0 text-brand" />
                    )}
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${done ? "text-muted-foreground line-through" : "font-medium"}`}
                    >
                      {t.label}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${done ? "bg-surface text-muted-foreground" : "bg-brand text-brand-foreground"}`}
                    >
                      {t.n}
                    </span>
                  </span>
                );
                return (
                  <li key={t.label}>
                    {t.panel ? (
                      <button
                        type="button"
                        onClick={() => openMessages()}
                        className="flex w-full rounded-xl px-2 py-1.5 text-left hover:bg-accent ui-transition"
                      >
                        {inner}
                      </button>
                    ) : (
                      <Link
                        to={t.to as string}
                        className="flex rounded-xl px-2 py-1.5 hover:bg-accent ui-transition"
                      >
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Лента активности */}
          <Card>
            <div className="text-sm font-bold">Лента активности</div>
            <ul className="mt-3 space-y-2.5">
              {extra.isLoading &&
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              {extra.data?.activity.length === 0 && (
                <li className="text-sm text-muted-foreground">Пока событий нет.</li>
              )}
              {extra.data?.activity.map((e) => (
                <li key={e.id} className="flex items-start gap-2.5 text-sm">
                  <span aria-hidden>{ACTIVITY_ICON[e.kind]}</span>
                  <span className="min-w-0">
                    <span className="block leading-snug">{e.text}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(e.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
