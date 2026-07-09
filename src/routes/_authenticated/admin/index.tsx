// Дашборд админа
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminDashboard } from "@/lib/admin/dashboard.functions";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, CartesianGrid } from "recharts";
import { Users, Package, ShoppingBag, Undo2, TrendingUp, DollarSign, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: DashboardPage,
});

function formatMoney(k: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(k / 100)) + " ₽";
}

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

  if (isLoading || !data) {
    return <div className="rounded-2xl bg-white p-8 text-center text-foreground/60">Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Дашборд</h1>
        <p className="text-foreground/60 text-sm mt-1">Общая статистика маркетплейса</p>
      </div>

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
