// Личный кабинет покупателя: список его заказов с текущими статусами позиций
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import {
  STATUS_BADGE,
  STATUS_LABELS,
  type OrderStatus,
} from "@/lib/order-status";
import { LogOut, Store } from "lucide-react";
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

// Компонент кабинета
function AccountPage() {
  const { user, isSeller } = useAuth();
  const qc = useQueryClient();

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
      return data;
    },
  });

  // Запоминаем прошлые статусы, чтобы показывать уведомления только при их смене
  const prevStatusesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!ordersQuery.data) return;
    const next: Record<string, string> = {};
    for (const o of ordersQuery.data) {
      for (const it of o.order_items ?? []) {
        const prev = prevStatusesRef.current[it.id];
        const cur = (it.status ?? "new") as OrderStatus;
        if (prev && prev !== cur) {
          // Показываем всплывающее сообщение о новом статусе
          toast.info(`«${it.title_snapshot}» — ${STATUS_LABELS[cur]}`);
        }
        next[it.id] = cur;
      }
    }
    prevStatusesRef.current = next;
  }, [ordersQuery.data]);

  // Подписываемся на изменения order_items в реальном времени
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`buyer-orders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_items" },
        () => {
          // При изменении обновляем список заказов
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
        <h2 className="text-xl font-bold mb-3">Мои заказы</h2>
        {ordersQuery.isLoading ? (
          <div className="text-muted-foreground">Загрузка...</div>
        ) : !ordersQuery.data || ordersQuery.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            У вас пока нет заказов.{" "}
            <Link to="/catalog" className="text-primary hover:underline">
              Посмотреть каталог
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {ordersQuery.data.map((o) => (
              <div key={o.id} className="rounded-2xl border bg-card p-4">
                <div className="flex justify-between items-start gap-2 flex-wrap">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      №{o.id.slice(0, 8).toUpperCase()} · {fmtDate(o.created_at)}
                    </div>
                  </div>
                  <div className="text-xl font-bold">{formatPrice(o.total_kopecks)}</div>
                </div>
                {/* Позиции заказа со статусами */}
                <div className="mt-3 space-y-2 text-sm border-t pt-3">
                  {o.order_items?.map((it) => {
                    const st = (it.status ?? "new") as OrderStatus;
                    return (
                      <div
                        key={it.id}
                        className="flex justify-between items-center gap-2 flex-wrap"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-foreground line-clamp-1">
                            {it.title_snapshot}{" "}
                            <span className="text-muted-foreground">× {it.quantity}</span>
                          </div>
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[st]}`}
                          >
                            {STATUS_LABELS[st]}
                          </span>
                        </div>
                        <div className="shrink-0 font-medium">
                          {formatPrice(it.price_kopecks * it.quantity)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
