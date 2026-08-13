// Кабинет продавца — боковой сайдбар и дашборд с виджетами статистики.
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { SellerSidebar, SellerTabs, useForceSellerMode } from "@/components/SellerSidebar";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import { getSellerTasks } from "@/lib/seller/tasks.functions";
import { getSellerDashboardSummary } from "@/lib/seller/dashboard.functions";
import { SellerDashboardHome } from "@/components/seller/DashboardHome";
import {
  SellerCommandPalette,
  SellerSearchButton,
  useCommandPaletteHotkey,
} from "@/components/seller/SellerCommandPalette";
import { usePanels } from "@/lib/panels-store";
import {
  Plus,
  Truck,
  Wallet,
  AlertTriangle,
  MessageSquare,
  PackageCheck,
  RotateCcw,
  Star,
  BarChart3,
  Eye,
  Clock,
  Mail,
  Hourglass,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/seller")({
  component: SellerLayout,
});

/** Мини-график выручки (sparkline) на SVG. */
function Sparkline({ data }: { data: { day: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100;
  const h = 32;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((d, i) => `${i * step},${h - (d.value / max) * (h - 4) - 2}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-10 w-full" preserveAspectRatio="none">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-brand"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={`0,${h} ${points.join(" ")} ${w},${h}`}
        className="fill-brand/10"
        stroke="none"
      />
    </svg>
  );
}

function SellerLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isDashboard = pathname === "/seller" || pathname === "/seller/";
  const fetchSummary = useServerFn(getSellerDashboardSummary);
  const fetchTasks = useServerFn(getSellerTasks);
  const openMessages = usePanels((s) => s.openMessages);
  const palette = useCommandPaletteHotkey();
  useForceSellerMode();

  const summary = useQuery({
    queryKey: ["seller-summary", user?.id],
    enabled: !!user,
    queryFn: () => fetchSummary(),
    refetchInterval: 120_000,
  });

  const tasks = useQuery({
    queryKey: ["seller-tasks", user?.id],
    enabled: !!user,
    queryFn: () => fetchTasks(),
    refetchInterval: 60_000,
  });

  const t = tasks.data;
  const s = summary.data;

  const taskCards = [
    {
      key: "orders",
      label: "Новые заказы",
      count: t?.newOrders ?? 0,
      icon: PackageCheck,
      to: "/seller/orders" as const,
      tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    {
      key: "ship",
      label: "Готовы к отправке",
      count: t?.toShip ?? 0,
      icon: Truck,
      to: "/seller/orders" as const,
      tone: "bg-sky-50 text-sky-800 border-sky-200",
    },
    {
      key: "stock",
      label: "Мало на складе",
      count: (t?.lowStock ?? 0) + (t?.outOfStock ?? 0),
      icon: AlertTriangle,
      to: "/seller/products" as const,
      tone: "bg-amber-50 text-amber-900 border-amber-200",
    },
    {
      key: "returns",
      label: "Возвраты",
      count: t?.returns ?? 0,
      icon: RotateCcw,
      to: "/seller/returns" as const,
      tone: "bg-rose-50 text-rose-800 border-rose-200",
    },
    {
      key: "reviews",
      label: "Низкие оценки",
      count: t?.lowRated ?? 0,
      icon: Star,
      to: "/seller/reviews" as const,
      tone: "bg-muted text-foreground border-border",
    },
  ].filter((c) => c.count > 0);

  return (
    <AppLayout>
      <SellerCommandPalette open={palette.open} onOpenChange={palette.setOpen} />
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
              <div className="flex flex-wrap items-center gap-2">
                <SellerSearchButton onClick={() => palette.setOpen(true)} />
                <button
                  onClick={() => navigate({ to: "/seller/products", search: { new: 1 } })}
                  className="inline-flex items-center gap-2 h-11 px-4 rounded-full bg-brand text-brand-foreground text-sm font-semibold hover:opacity-90 ui-transition"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.25} /> Добавить товар
                </button>
                <Link
                  to="/seller/orders"
                  className="inline-flex items-center gap-2 h-11 px-4 rounded-full border text-sm font-semibold hover:bg-accent ui-transition"
                >
                  <PackageCheck className="h-4 w-4" /> Новые заказы
                  <Badge value={s?.newOrders ?? t?.newOrders ?? 0} />
                </Link>
                <button
                  type="button"
                  onClick={() => openMessages()}
                  className="inline-flex items-center gap-2 h-11 px-4 rounded-full border text-sm font-semibold hover:bg-accent ui-transition"
                >
                  <Mail className="h-4 w-4" /> Непрочитанных
                  <Badge value={s?.unread ?? t?.unread ?? 0} />
                </button>
                <Link
                  to="/seller/products"
                  className="inline-flex items-center gap-2 h-11 px-4 rounded-full border text-sm font-semibold hover:bg-accent ui-transition"
                >
                  <Hourglass className="h-4 w-4" /> На модерации
                  <Badge value={s?.pendingModeration ?? t?.pendingModeration ?? 0} />
                </Link>
                <Link
                  to="/seller/analytics"
                  className="inline-flex items-center gap-2 h-11 px-4 rounded-full border text-sm font-semibold hover:bg-accent ui-transition"
                >
                  <BarChart3 className="h-4 w-4" /> Аналитика
                </Link>
              </div>
            </div>

            {/* Задачи, требующие внимания */}
            {isDashboard && <SellerDashboardHome summary={s} />}

            <Outlet />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Badge({ value }: { value: number }) {
  return (
    <span
      className={`min-w-[20px] h-5 px-1.5 grid place-items-center rounded-full text-[11px] font-bold tabular-nums ${
        value > 0 ? "bg-brand text-brand-foreground" : "bg-surface text-muted-foreground"
      }`}
    >
      {value}
    </span>
  );
}

function Widget({
  icon: Icon,
  label,
  value,
  hint,
  to,
  loading,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  hint?: string;
  to?: "/seller/orders" | "/seller/reviews";
  loading?: boolean;
}) {
  const inner = (
    <div className="rounded-2xl bg-card hairline p-4 h-full ui-transition hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </div>
          {loading ? (
            <div className="mt-2 h-7 w-24 rounded bg-surface animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-xl md:text-2xl font-extrabold break-words">
              {value}
            </div>
          )}
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-surface shrink-0">
          <Icon className="h-4 w-4 text-foreground/70" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
