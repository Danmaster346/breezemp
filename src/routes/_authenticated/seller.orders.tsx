// Заказы продавца: таблица с возможностью менять статус позиции
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import {
  NEXT_STATUS,
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

  // Загружаем позиции заказов, где продавец = текущий пользователь
  const q = useQuery({
    queryKey: ["seller-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select(
          "*, orders(id, created_at, shipping_name, shipping_phone, shipping_address)",
        )
        .eq("seller_id", user!.id)
        .order("id", { ascending: false });
      if (error) throw error;
      return data;
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
      toast.success(`Статус обновлён: ${STATUS_LABELS[v.status]}`, {
        description: v.title,
      });
      qc.invalidateQueries({ queryKey: ["seller-orders", user?.id] });
      qc.invalidateQueries({ queryKey: ["seller-stats"] });
    },
    onError: (e: Error) => toast.error("Не удалось обновить статус", { description: e.message }),
  });

  return (
    <div>
      {q.isLoading ? (
        <div className="text-muted-foreground">Загрузка...</div>
      ) : !q.data || q.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          Пока нет заказов на ваши товары.
        </div>
      ) : (
        <div className="space-y-3">
          {q.data.map((it) => {
            // Считаем сумму позиции и выручку продавца после комиссии платформы
            const line = it.price_kopecks * it.quantity;
            const payout = line - it.commission_kopecks;
            const status = (it.status ?? "new") as OrderStatus;
            return (
              <div key={it.id} className="rounded-2xl border bg-card p-4">
                <div className="flex justify-between items-start gap-2 flex-wrap">
                  <div>
                    <div className="font-semibold">{it.title_snapshot}</div>
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
                {/* Управление статусом */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <label className="text-sm text-muted-foreground">Статус:</label>
                  <select
                    value={status}
                    disabled={m.isPending}
                    onChange={(e) =>
                      m.mutate({
                        order_item_id: it.id,
                        status: e.target.value as OrderStatus,
                        title: it.title_snapshot,
                      })
                    }
                    className="h-9 px-2 rounded-lg border bg-background text-sm"
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
