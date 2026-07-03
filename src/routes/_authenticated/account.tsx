// Личный кабинет покупателя: список его заказов
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
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
  // Данные пользователя и роль
  const { user, isSeller } = useAuth();

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
                    <div className="text-xs mt-1">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                        {o.status === "new" ? "Новый" : o.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-xl font-bold">{formatPrice(o.total_kopecks)}</div>
                </div>
                {/* Позиции заказа */}
                <div className="mt-3 space-y-1 text-sm">
                  {o.order_items?.map((it) => (
                    <div key={it.id} className="flex justify-between gap-2">
                      <span className="text-muted-foreground line-clamp-1">
                        {it.title_snapshot} × {it.quantity}
                      </span>
                      <span>{formatPrice(it.price_kopecks * it.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
