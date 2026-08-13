// Дашборд админа
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminDashboard } from "@/lib/admin/dashboard.functions";
import { moderateProduct } from "@/lib/admin/products.functions";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Users, Package, ShoppingBag, Undo2, TrendingUp, DollarSign, AlertCircle, Check, X, ImageOff, Boxes, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: DashboardPage,
});

const PIE_COLORS = ["hsl(var(--brand))", "#60a5fa", "#f59e0b", "#34d399", "#f472b6"];

function formatMoney(k: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(k / 100)) + " ₽";
}

const TABS = [
  { key: "overview", label: "Обзор" },
  { key: "sales", label: "Продажи" },
  { key: "users", label: "Пользователи" },
  { key: "products", label: "Товары" },
] as const;

type TabKey = (typeof TABS)[number]["key"];
type DashboardData = Awaited<ReturnType<typeof getAdminDashboard>>;

function StatCard({ icon: Icon, label, value, hint, tone = "default" }: { icon: React.ElementType; label: string; value: string; hint?: string; tone?: "default" | "brand" | "warn" }) {
  const toneClass = tone === "brand" ? "bg-brand/10 text-brand" : tone === "warn" ? "bg-orange-50 text-orange-600" : "bg-surface text-foreground";
  return (
    <div className="rounded-2xl bg-white border border-border/60 p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-foreground/60 truncate">{label}</div>
          <div className="text-lg font-bold truncate">{value}</div>
        </div>
      </div>
      {hint && <div className="mt-2 text-[11px] text-foreground/50">{hint}</div>}
    </div>
  );
}

function DashboardPage() {
  const fetch = useServerFn(getAdminDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => fetch() });
  const [tab, setTab] = useState<TabKey>("overview");

  if (isLoading || !data) {
    return <div className="rounded-2xl bg-white p-8 text-center text-foreground/60">Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Дашборд</h1>
        <p className="text-foreground/60 text-sm mt-1">Общая статистика маркетплейса</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${
              tab === t.key ? "bg-brand text-brand-foreground" : "bg-white border border-border/60 text-foreground/70 hover:bg-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "sales" && <SalesTab data={data} />}
      {tab === "users" && <UsersTab data={data} />}
      {tab === "products" && <ProductsTab data={data} />}
    </div>
  );
}

function OverviewTab({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      {/* Быстрые действия */}
      {(data.products.pending > 0 || data.returns.pending > 0) && (
        <div className="rounded-2xl bg-orange-50 border border-orange-200 p-4 flex flex-wrap items-center gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <div className="text-sm text-foreground/80 flex-1 min-w-0">
            Требует внимания:
            {data.products.pending > 0 && (
              <Link to="/admin/products" search={{ status: "pending" } as never} className="ml-2 font-semibold text-brand hover:underline">
                {data.products.pending} товаров на модерации
              </Link>
            )}
            {data.returns.pending > 0 && (
              <Link to="/admin/returns" search={{ status: "pending" } as never} className="ml-2 font-semibold text-brand hover:underline">
                {data.returns.pending} новых возвратов
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Карточки статистики */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Новых покупателей (30д)" value={String(data.users.buyersMonth)} hint={`Сегодня: ${data.users.buyersToday}`} />
        <StatCard icon={Package} label="Новых товаров (30д)" value={String(data.products.month)} hint={`За неделю: ${data.products.week}`} />
        <StatCard icon={ShoppingBag} label="Заказов (30д)" value={String(data.orders.month.count)} hint={`Сегодня: ${data.orders.today.count}`} tone="brand" />
        <StatCard icon={TrendingUp} label="Оборот (30д)" value={formatMoney(data.orders.month.total)} hint={`Неделя: ${formatMoney(data.orders.week.total)}`} />
        <StatCard icon={DollarSign} label="Комиссии (30д)" value={formatMoney(data.orders.month.commission)} tone="brand" />
        <StatCard icon={Users} label="Продавцов всего" value={String(data.users.sellersTotal)} />
        <StatCard icon={Undo2} label="Возвратов" value={String(data.returns.total)} hint={`Новых: ${data.returns.pending}`} tone={data.returns.pending > 0 ? "warn" : "default"} />
        <StatCard icon={Package} label="На модерации" value={String(data.products.pending)} tone={data.products.pending > 0 ? "warn" : "default"} />
      </div>

      {/* График заказов */}
      <div className="rounded-2xl bg-white border border-border/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Динамика заказов (30 дней)</h2>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.chart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => (v as string).slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--brand))" strokeWidth={2} dot={false} name="Заказов" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-border/60 p-4">
          <h2 className="font-semibold mb-3">Топ-5 категорий</h2>
          {data.topCategories.length === 0 ? (
            <div className="text-sm text-foreground/50 text-center py-8">Нет данных</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topCategories} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(v: number) => `${Math.round(v)} ₽`} />
                  <Bar dataKey="revenue" fill="hsl(var(--brand))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-border/60 p-4">
          <h2 className="font-semibold mb-3">Топ-10 продавцов по выручке</h2>
          {data.topSellers.length === 0 ? (
            <div className="text-sm text-foreground/50 text-center py-8">Нет данных</div>
          ) : (
            <div className="space-y-2">
              {data.topSellers.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <div className="h-7 w-7 rounded-full bg-surface flex items-center justify-center text-xs font-bold text-foreground/60">{i + 1}</div>
                  <Link to="/seller/$id" params={{ id: s.id }} className="flex-1 min-w-0 truncate font-medium hover:text-brand transition">{s.name}</Link>
                  <div className="font-semibold tabular-nums">{Math.round(s.revenue).toLocaleString("ru-RU")} ₽</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SalesTab({ data }: { data: DashboardData }) {
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const revenueData = data.revenueSeries.slice(-period);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-border/60 p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold">Динамика выручки</h2>
          <div className="flex gap-1">
            {([7, 30, 90] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  period === p ? "bg-brand text-brand-foreground" : "bg-surface text-foreground/60 hover:bg-surface/80"
                }`}
              >
                {p} дней
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => (v as string).slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${Math.round(v)} ₽`} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--brand))" strokeWidth={2} dot={false} name="Выручка, ₽" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 p-4">
        <h2 className="font-semibold mb-3">Средний чек по дням (30 дней)</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.avgCheckChart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => (v as string).slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v} ₽`} />
              <Line type="monotone" dataKey="avg" stroke="#f59e0b" strokeWidth={2} dot={false} name="Средний чек, ₽" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-border/60 p-4">
          <h2 className="font-semibold mb-3">Топ-10 товаров</h2>
          {data.top10Products.length === 0 ? (
            <div className="text-sm text-foreground/50 text-center py-8">Нет данных</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-foreground/50 border-b border-border/60">
                    <th className="py-1.5 pr-2 font-medium">Товар</th>
                    <th className="py-1.5 pr-2 font-medium">Продано</th>
                    <th className="py-1.5 font-medium">Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top10Products.map((p) => (
                    <tr key={p.id} className="border-b border-border/30 last:border-0">
                      <td className="py-1.5 pr-2 truncate max-w-[180px]">{p.title}</td>
                      <td className="py-1.5 pr-2 tabular-nums">{p.qty}</td>
                      <td className="py-1.5 tabular-nums font-medium">{Math.round(p.revenue).toLocaleString("ru-RU")} ₽</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-border/60 p-4">
          <h2 className="font-semibold mb-3">Топ-5 категорий</h2>
          {data.topCategories.length === 0 ? (
            <div className="text-sm text-foreground/50 text-center py-8">Нет данных</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.topCategories} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                    {data.topCategories.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${Math.round(v)} ₽`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 p-4">
        <h2 className="font-semibold mb-3">Конверсия: просмотры → заказы (30 дней)</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-foreground/60">Просмотры</div>
            <div className="text-xl font-bold">{data.conversion.views}</div>
          </div>
          <div>
            <div className="text-xs text-foreground/60">Заказы</div>
            <div className="text-xl font-bold">{data.conversion.orders}</div>
          </div>
          <div>
            <div className="text-xs text-foreground/60">Конверсия</div>
            <div className="text-xl font-bold text-brand">{data.conversion.rate}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab({ data }: { data: DashboardData }) {
  const splitData = [
    { name: "Покупатели", value: data.usersSplit.buyers },
    { name: "Продавцы", value: data.usersSplit.sellers },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard icon={Users} label="Активных пользователей (7д)" value={String(data.activeUsers7d)} tone="brand" />
        <StatCard icon={Users} label="Всего профилей" value={String(data.usersSplit.buyers)} hint={`Продавцов: ${data.usersSplit.sellers}`} />
      </div>

      <div className="rounded-2xl bg-white border border-border/60 p-4">
        <h2 className="font-semibold mb-3">Новые регистрации (30 дней)</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.newUsersChart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => (v as string).slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} name="Регистраций" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-border/60 p-4">
          <h2 className="font-semibold mb-3">Покупатели / продавцы</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={splitData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                  {splitData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-border/60 p-4">
          <h2 className="font-semibold mb-3">Топ-10 покупателей</h2>
          {data.topBuyers.length === 0 ? (
            <div className="text-sm text-foreground/50 text-center py-8">Нет данных</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-foreground/50 border-b border-border/60">
                    <th className="py-1.5 pr-2 font-medium">Покупатель</th>
                    <th className="py-1.5 font-medium">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topBuyers.map((b) => (
                    <tr key={b.id} className="border-b border-border/30 last:border-0">
                      <td className="py-1.5 pr-2 truncate max-w-[180px]">{b.name}</td>
                      <td className="py-1.5 tabular-nums font-medium">{Math.round(b.total).toLocaleString("ru-RU")} ₽</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductsTab({ data }: { data: DashboardData }) {
  const moderate = useServerFn(moderateProduct);
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await moderate({ data: { productId: id, action: "approve" } });
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    const reason = window.prompt("Причина отклонения:");
    if (reason === null) return;
    setBusyId(id);
    try {
      await moderate({ data: { productId: id, action: "reject", reason } });
      await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-border/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-brand" />
          <h2 className="font-semibold">Ожидают модерации ({data.productIssues.pendingModeration.length})</h2>
        </div>
        {data.productIssues.pendingModeration.length === 0 ? (
          <div className="text-sm text-foreground/50 text-center py-8">Нет товаров на модерации</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-foreground/50 border-b border-border/60">
                  <th className="py-1.5 pr-2 font-medium">Товар</th>
                  <th className="py-1.5 pr-2 font-medium">Продавец</th>
                  <th className="py-1.5 pr-2 font-medium">Цена</th>
                  <th className="py-1.5 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {data.productIssues.pendingModeration.map((p) => (
                  <tr key={p.id} className="border-b border-border/30 last:border-0">
                    <td className="py-1.5 pr-2 truncate max-w-[180px]">{p.title}</td>
                    <td className="py-1.5 pr-2 truncate max-w-[140px]">{p.seller_name}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{formatMoney(p.price_kopecks)}</td>
                    <td className="py-1.5">
                      <div className="flex gap-1.5">
                        <button
                          disabled={busyId === p.id}
                          onClick={() => handleApprove(p.id)}
                          className="h-7 w-7 rounded-lg bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 disabled:opacity-50"
                          title="Одобрить"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          disabled={busyId === p.id}
                          onClick={() => handleReject(p.id)}
                          className="h-7 w-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 disabled:opacity-50"
                          title="Отклонить"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ImageOff className="h-4 w-4 text-orange-500" />
            <h2 className="font-semibold text-sm">Без фото ({data.productIssues.noPhoto.length})</h2>
          </div>
          {data.productIssues.noPhoto.length === 0 ? (
            <div className="text-xs text-foreground/50 text-center py-6">Нет таких товаров</div>
          ) : (
            <ul className="space-y-1.5 text-sm max-h-64 overflow-y-auto">
              {data.productIssues.noPhoto.map((p) => (
                <li key={p.id} className="truncate">{p.title}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Boxes className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold text-sm">Нулевой сток ({data.productIssues.zeroStock.length})</h2>
          </div>
          {data.productIssues.zeroStock.length === 0 ? (
            <div className="text-xs text-foreground/50 text-center py-6">Нет таких товаров</div>
          ) : (
            <ul className="space-y-1.5 text-sm max-h-64 overflow-y-auto">
              {data.productIssues.zeroStock.map((p) => (
                <li key={p.id} className="truncate">{p.title}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-brand" />
            <h2 className="font-semibold text-sm">Новые за 7 дней ({data.productIssues.newWeek.length})</h2>
          </div>
          {data.productIssues.newWeek.length === 0 ? (
            <div className="text-xs text-foreground/50 text-center py-6">Нет новых товаров</div>
          ) : (
            <ul className="space-y-1.5 text-sm max-h-64 overflow-y-auto">
              {data.productIssues.newWeek.map((p) => (
                <li key={p.id} className="truncate">{p.title}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

