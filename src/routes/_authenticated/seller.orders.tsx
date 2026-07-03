// Заказы продавца: показываем позиции, относящиеся к текущему продавцу
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";

// Маршрут «/seller/orders»
export const Route = createFileRoute("/_authenticated/seller/orders")({
  head: () => ({ meta: [{ title: "Мои заказы — продавец — BreezeMarket" }] }),
  component: SellerOrdersPage,
});

// Форматирование даты
const fmt = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

// Компонент страницы
function SellerOrdersPage() {
  const { user } = useAuth();

  // Загружаем позиции заказов, где продавец = текущий пользователь
  const q = useQuery({
    queryKey: ["seller-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, orders(id, created_at, status, shipping_name, shipping_phone, shipping_address)")
        .eq("seller_id", user!.id)
        .order("id", { ascending: false });
      if (error) throw error;
      return data;
    },
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
            // Считаем сумму позиции и выручку продавца после комиссии
            const line = it.price_kopecks * it.quantity;
            const payout = line - it.commission_kopecks;
            return (
              <div key={it.id} className="rounded-2xl border bg-card p-4">
                <div className="flex justify-between items-start gap-2 flex-wrap">
                  <div>
                    <div className="font-semibold">{it.title_snapshot}</div>
                    <div className="text-sm text-muted-foreground">
                      Заказ №{it.orders?.id.slice(0, 8).toUpperCase()} ·{" "}
                      {it.orders && fmt(it.orders.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{formatPrice(line)}</div>
                    <div className="text-xs text-muted-foreground">
                      × {it.quantity} · комиссия 10%
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
                  <div className="text-primary font-medium">
                    К выплате: {formatPrice(payout)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
