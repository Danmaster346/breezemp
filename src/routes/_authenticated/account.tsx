// Личный кабинет покупателя: список его заказов и модалка с деталями
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import {
  ALL_STATUSES,
  STATUS_BADGE,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/order-status";
import { LogOut, Store, X, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

// Маршрут «/account»
export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Мои заказы — BreezeMarket" }] }),
  component: AccountPage,
});

// Форматирование даты по-русски
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Тип позиции заказа (для локальных вычислений)
type OrderItem = {
  id: string;
  title_snapshot: string;
  image_url: string | null;
  price_kopecks: number;
  quantity: number;
  commission_kopecks: number | null;
  status: string | null;
};

// Тип заказа
type Order = {
  id: string;
  buyer_id: string;
  total_kopecks: number;
  commission_kopecks: number | null;
  status: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  created_at: string;
  order_items: OrderItem[];
};

// Агрегированный статус: минимальная стадия по всем позициям
// (заказ считается «доставленным» только когда все позиции доставлены).
function aggregateStatus(items: OrderItem[]): OrderStatus {
  if (!items.length) return "new";
  const nonCancelled = items.filter((it) => (it.status ?? "new") !== "cancelled");
  if (!nonCancelled.length) return "cancelled";
  let minIdx = ALL_STATUSES.length;
  for (const it of nonCancelled) {
    const st = (it.status ?? "new") as OrderStatus;
    const idx = ALL_STATUSES.indexOf(st);
    if (idx >= 0 && idx < minIdx) minIdx = idx;
  }
  return ALL_STATUSES[minIdx] ?? "new";
}

// Общая комиссия по заказу — из БД или сумма по позициям
function orderCommission(o: Order): number {
  if (o.commission_kopecks != null) return o.commission_kopecks;
  return (o.order_items ?? []).reduce(
    (acc, it) => acc + (it.commission_kopecks ?? 0) * it.quantity,
    0,
  );
}

// Компонент кабинета
function AccountPage() {
  const { user, isSeller } = useAuth();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  // Загружаем заказы покупателя со связанными позициями
  const ordersQuery = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
  });

  const orders = ordersQuery.data ?? [];
  const openOrder = useMemo(
    () => orders.find((o) => o.id === openId) ?? null,
    [orders, openId],
  );

  // Уведомляем об изменениях статусов позиций
  const prevStatusesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!orders.length) return;
    const next: Record<string, string> = {};
    for (const o of orders) {
      for (const it of o.order_items ?? []) {
        const prev = prevStatusesRef.current[it.id];
        const cur = (it.status ?? "new") as OrderStatus;
        if (prev && prev !== cur) {
          toast.info(`«${it.title_snapshot}» — ${STATUS_LABELS[cur]}`);
        }
        next[it.id] = cur;
      }
    }
    prevStatusesRef.current = next;
  }, [orders]);

  // Realtime-обновление статусов
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`buyer-orders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_items" },
        () => {
          qc.invalidateQueries({ queryKey: ["my-orders", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  // Выход из аккаунта
  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Вы вышли из аккаунта");
    window.location.href = "/";
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Шапка кабинета */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Личный кабинет</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex gap-2">
            {isSeller && (
              <Link
                to="/seller/products"
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
              >
                <Store className="h-4 w-4" /> Кабинет продавца
              </Link>
            )}
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent"
            >
              <LogOut className="h-4 w-4" /> Выйти
            </button>
          </div>
        </div>

        {/* Секция заказов */}
        <h2 className="text-xl font-bold mb-3">История заказов</h2>
        {ordersQuery.isLoading ? (
          <div className="text-muted-foreground">Загрузка...</div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">У вас пока нет заказов.</p>
            <Link
              to="/catalog"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90"
            >
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const status = aggregateStatus(o.order_items ?? []);
              const items = o.order_items ?? [];
              const itemsCount = items.reduce((a, it) => a + it.quantity, 0);
              const preview = items
                .slice(0, 2)
                .map((it) => `${it.title_snapshot} × ${it.quantity}`)
                .join(", ");
              const more = items.length > 2 ? `, ещё ${items.length - 2}` : "";
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOpenId(o.id)}
                  className="w-full text-left rounded-2xl border bg-card p-4 hover:shadow-md hover:border-primary/40 transition"
                >
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-mono text-sm">
                        №{o.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(o.created_at)}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-between items-end gap-3">
                    <div className="text-sm text-muted-foreground line-clamp-2 min-w-0">
                      {itemsCount} {itemsCount === 1 ? "товар" : "товаров"}:{" "}
                      <span className="text-foreground">
                        {preview}
                        {more}
                      </span>
                    </div>
                    <div className="text-lg font-bold shrink-0">
                      {formatPrice(o.total_kopecks)}
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-primary font-medium">
                    Подробнее →
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Модалка деталей заказа */}
      {openOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => setOpenId(null)}
        >
          <div
            className="w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl border shadow-lg max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-card z-10">
              <div>
                <div className="font-semibold">
                  Заказ №{openOrder.id.slice(0, 8).toUpperCase()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtDate(openOrder.created_at)}
                </div>
              </div>
              <button
                onClick={() => setOpenId(null)}
                className="p-1 rounded hover:bg-accent"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Общий статус */}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Статус заказа</div>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-sm font-medium ${STATUS_BADGE[aggregateStatus(openOrder.order_items ?? [])]}`}
                >
                  {STATUS_LABELS[aggregateStatus(openOrder.order_items ?? [])]}
                </span>
              </div>

              {/* Адрес доставки */}
              {(openOrder.shipping_name ||
                openOrder.shipping_phone ||
                openOrder.shipping_address) && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Доставка</div>
                  <div className="text-sm space-y-0.5">
                    {openOrder.shipping_name && (
                      <div className="font-medium">{openOrder.shipping_name}</div>
                    )}
                    {openOrder.shipping_phone && (
                      <div className="text-muted-foreground">
                        {openOrder.shipping_phone}
                      </div>
                    )}
                    {openOrder.shipping_address && (
                      <div className="text-muted-foreground">
                        {openOrder.shipping_address}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Товары */}
              <div>
                <div className="text-xs text-muted-foreground mb-2">
                  Товары в заказе ({openOrder.order_items?.length ?? 0})
                </div>
                <div className="space-y-2">
                  {openOrder.order_items?.map((it) => {
                    const st = (it.status ?? "new") as OrderStatus;
                    return (
                      <div
                        key={it.id}
                        className="flex gap-3 rounded-xl border p-2.5"
                      >
                        <div className="h-14 w-14 rounded-lg bg-muted overflow-hidden shrink-0">
                          {it.image_url ? (
                            <img
                              src={it.image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-lg">
                              🛍️
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm line-clamp-2">
                            {it.title_snapshot}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatPrice(it.price_kopecks)} × {it.quantity}
                          </div>
                          <span
                            className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[st]}`}
                          >
                            {STATUS_LABELS[st]}
                          </span>
                        </div>
                        <div className="text-sm font-semibold shrink-0">
                          {formatPrice(it.price_kopecks * it.quantity)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Итого */}
              <div className="rounded-xl bg-muted/50 p-3 text-sm">
                <div className="flex justify-between font-bold text-base">
                  <span>Итого оплачено</span>
                  <span>{formatPrice(openOrder.total_kopecks)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
