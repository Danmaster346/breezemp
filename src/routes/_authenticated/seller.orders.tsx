// Заказы продавца: таблица с возможностью менять статус позиции
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import { getSellerOrderItems } from "@/lib/order-history.functions";
import {
  ALL_STATUSES,
  NEXT_STATUS,
  NOTIFY_STATUSES,
  STATUS_BADGE,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/order-status";
import { updateOrderItemStatus } from "@/lib/order-status.functions";
import { toast } from "sonner";

// Маршрут «/seller/orders»
export const Route = createFileRoute("/_authenticated/seller/orders")({
  head: () => ({ meta: [{ title: "Мои заказы — продавец — BreezeMarket" }] }),
  component: SellerOrdersPage,
});




// Форматирование даты
const fmt = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

// Компонент страницы
function SellerOrdersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Обёртка серверной функции, чтобы автоматически подставился bearer-токен
  const updateStatus = useServerFn(updateOrderItemStatus);
  const fetchSellerOrders = useServerFn(getSellerOrderItems);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  // Загружаем позиции заказов, где продавец = текущий пользователь
  const q = useQuery({
    queryKey: ["seller-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      return fetchSellerOrders();
    },
  });

  // Мутация смены статуса позиции
  const m = useMutation({
    mutationFn: (v: {
      order_item_id: string;
      status: OrderStatus;
      title?: string;
    }) => updateStatus({ data: { order_item_id: v.order_item_id, status: v.status } }),
    onSuccess: (_r, v) => {
      // Красивое уведомление на ключевых стадиях
      // Красивое уведомление на ключевых стадиях
      if (NOTIFY_STATUSES.includes(v.status)) {
        toast.success(`Статус обновлён: ${STATUS_LABELS[v.status]}`, {
          description: v.title,
        });
      } else {
        toast(`Статус обновлён: ${STATUS_LABELS[v.status]}`, { description: v.title });
      }
      qc.invalidateQueries({ queryKey: ["seller-orders", user?.id] });
      qc.invalidateQueries({ queryKey: ["seller-stats"] });
    },
    onError: (e: Error) => toast.error("Не удалось обновить статус", { description: e.message }),
  });

  const all = q.data ?? [];
  const counts: Record<string, number> = { all: all.length };
  for (const it of all) {
    const s = it.status ?? "new";
    counts[s] = (counts[s] ?? 0) + 1;
  }
  const filtered = statusFilter === "all"
    ? all
    : all.filter((it) => (it.status ?? "new") === statusFilter);

  return (
    <div>
      {/* Фильтры по статусам */}
      {all.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter("all")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
              statusFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
            }`}
          >
            Все <span className="opacity-70">({counts.all})</span>
          </button>
          {ALL_STATUSES.map((s) => {
            const n = counts[s] ?? 0;
            if (n === 0) return null;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                  active ? "bg-primary text-primary-foreground border-primary" : `${STATUS_BADGE[s]} border-transparent hover:opacity-90`
                }`}
              >
                {STATUS_LABELS[s]} <span className="opacity-70">({n})</span>
              </button>
            );
          })}
        </div>
      )}

      {q.isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : q.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Не удалось загрузить заказы продавца. Обновите страницу или попробуйте ещё раз.
        </div>
      ) : all.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Пока нет заказов на ваши товары.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Нет заказов в выбранном статусе.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => {
            // Считаем сумму позиции и выручку продавца после комиссии платформы
            const line = it.price_kopecks * it.quantity;
            const payout = line - it.commission_kopecks;
            const status = (it.status ?? "new") as OrderStatus;
            return (
              <div key={it.id} className="rounded-2xl border bg-card p-4">
                <div className="flex justify-between items-start gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">{it.title_snapshot}</div>
                      {it.product_id && (
                        <Link
                          to="/product/$id"
                          params={{ id: it.product_id }}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition"
                          title="Открыть карточку товара"
                        >
                          <ExternalLink className="h-3 w-3" /> К товару
                        </Link>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      Заказ №{it.orders?.id.slice(0, 8).toUpperCase()} ·{" "}
                      {it.orders && fmt(it.orders.created_at)}
                    </div>
                    {/* Плашка текущего статуса */}
                    <span
                      className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      Заплатил покупатель
                    </div>
                    <div className="text-lg font-bold">{formatPrice(line)}</div>
                    <div className="text-xs text-muted-foreground">× {it.quantity}</div>
                    <div className="mt-1 text-sm text-emerald-600 font-semibold">
                      К выплате: {formatPrice(payout)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      после комиссии платформы 10%
                    </div>
                  </div>
                </div>
                <div className="mt-3 border-t pt-3 text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground">Покупатель:</span>{" "}
                    {it.orders?.shipping_name}, {it.orders?.shipping_phone}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Адрес:</span>{" "}
                    {it.orders?.shipping_address}
                  </div>
                </div>
                {/* Управление статусом — последовательный пайплайн + возврат/отмена */}
                {status !== "received" &&
                  status !== "returned" &&
                  status !== "cancelled" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                      {NEXT_STATUS[status] && (
                        <button
                          type="button"
                          disabled={m.isPending}
                          onClick={() =>
                            m.mutate({
                              order_item_id: it.id,
                              status: NEXT_STATUS[status]!,
                              title: it.title_snapshot,
                            })
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          Перевести в: {STATUS_LABELS[NEXT_STATUS[status]!]}
                        </button>
                      )}
                      {/* Возврат доступен после доставки */}
                      {(status === "delivered" || status === "shipped") && (
                        <button
                          type="button"
                          disabled={m.isPending}
                          onClick={() => {
                            if (confirm("Оформить возврат этой позиции?")) {
                              m.mutate({
                                order_item_id: it.id,
                                status: "returned",
                                title: it.title_snapshot,
                              });
                            }
                          }}
                          className="inline-flex items-center rounded-lg border border-orange-300 text-orange-700 px-3 py-2 text-sm hover:bg-orange-50 disabled:opacity-50"
                        >
                          Возврат
                        </button>
                      )}
                      {/* Отмена — пока заказ не отправлен */}
                      {(status === "new" ||
                        status === "confirmed" ||
                        status === "processing") && (
                        <button
                          type="button"
                          disabled={m.isPending}
                          onClick={() => {
                            if (confirm("Отменить эту позицию заказа?")) {
                              m.mutate({
                                order_item_id: it.id,
                                status: "cancelled",
                                title: it.title_snapshot,
                              });
                            }
                          }}
                          className="inline-flex items-center rounded-lg border px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"
                        >
                          Отмена
                        </button>
                      )}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
