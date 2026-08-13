// Блок уведомлений и алертов кабинета продавца: критические, важные и информационные.
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Bell, Info, XOctagon } from "lucide-react";
import { usePanels } from "@/lib/panels-store";
import type { SellerCounters } from "@/lib/seller/dashboard-extra.functions";

type Level = "critical" | "warning" | "info";

type Alert = {
  id: string;
  level: Level;
  text: string;
  to?: string;
  search?: Record<string, unknown>;
  panel?: boolean;
};

const LEVEL_META: Record<Level, { tone: string; icon: typeof Info; label: string }> = {
  critical: {
    tone: "bg-destructive/10 text-destructive border-destructive/20",
    icon: XOctagon,
    label: "Критично",
  },
  warning: {
    tone: "bg-amber-500/10 text-amber-800 border-amber-500/20",
    icon: AlertTriangle,
    label: "Важно",
  },
  info: {
    tone: "bg-emerald-500/10 text-emerald-800 border-emerald-500/20",
    icon: Info,
    label: "Инфо",
  },
};

/** Собирает список алертов из счётчиков дашборда. */
function buildAlerts(c: SellerCounters): Alert[] {
  const list: Alert[] = [];

  if (c.outOfStock > 0)
    list.push({
      id: "out-of-stock",
      level: "critical",
      text: `Нет в наличии: ${c.outOfStock} товар(ов) — продажи остановлены`,
      to: "/seller/warehouse",
    });
  if (c.rejectedProducts > 0)
    list.push({
      id: "rejected",
      level: "critical",
      text: `Отклонено модерацией: ${c.rejectedProducts} товар(ов)`,
      to: "/seller/products",
    });

  if (c.lowStock > 0)
    list.push({
      id: "low-stock",
      level: "warning",
      text: `Низкий остаток у ${c.lowStock} товар(ов) — пополните склад`,
      to: "/seller/warehouse",
    });
  if (c.noPhoto > 0)
    list.push({
      id: "no-photo",
      level: "warning",
      text: `${c.noPhoto} товар(ов) без фото — конверсия ниже`,
      to: "/seller/products",
    });
  if (c.pendingProducts > 0)
    list.push({
      id: "pending",
      level: "warning",
      text: `На модерации: ${c.pendingProducts} товар(ов)`,
      to: "/seller/products",
    });

  if (c.newOrdersToday > 0)
    list.push({
      id: "new-orders",
      level: "info",
      text: `Новых заказов сегодня: ${c.newOrdersToday}`,
      to: "/seller/orders",
    });
  if (c.reviewsWaiting > 0)
    list.push({
      id: "reviews",
      level: "info",
      text: `Отзывов без ответа: ${c.reviewsWaiting}`,
      to: "/seller/reviews",
    });
  if (c.unread > 0)
    list.push({
      id: "unread",
      level: "info",
      text: `Непрочитанных сообщений от покупателей: ${c.unread}`,
      panel: true,
    });

  return list;
}

export function SellerAlerts({ counters }: { counters?: SellerCounters }) {
  const openMessages = usePanels((s) => s.openMessages);
  if (!counters) return null;

  const alerts = buildAlerts(counters);
  if (alerts.length === 0)
    return (
      <div className="rounded-2xl bg-card hairline p-4 text-sm text-muted-foreground">
        <span className="mr-2">🟢</span> Всё под контролем — критических уведомлений нет.
      </div>
    );

  return (
    <div className="rounded-2xl bg-card hairline p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <Bell className="h-4 w-4" /> Уведомления и алерты
        <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
          {alerts.length}
        </span>
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {alerts.map((a) => {
          const meta = LEVEL_META[a.level];
          const Icon = meta.icon;
          const inner = (
            <>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{a.text}</span>
            </>
          );
          return (
            <li key={a.id}>
              {a.panel ? (
                <button
                  type="button"
                  onClick={() => openMessages()}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ui-transition hover:opacity-80 ${meta.tone}`}
                >
                  {inner}
                </button>
              ) : (
                <Link
                  to={a.to!}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ui-transition hover:opacity-80 ${meta.tone}`}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
