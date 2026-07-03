// Страница корзины
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useCart } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";

// Определяем маршрут «/cart»
export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Корзина — BreezeMarket" }] }),
  component: CartPage,
});

// Компонент корзины
function CartPage() {
  // Достаём состояние и действия из стора
  const items = useCart((s) => s.items);
  const remove = useCart((s) => s.remove);
  const setQty = useCart((s) => s.setQty);
  const total = useCart((s) => s.totalKopecks());

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Корзина</h1>

        {items.length === 0 ? (
          // Пустая корзина
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">В корзине пока пусто</p>
            <Link
              to="/catalog"
              className="inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90"
            >
              К покупкам
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_320px] gap-6">
            {/* Список позиций */}
            <div className="space-y-3">
              {items.map((i) => (
                <div key={i.id} className="flex gap-3 rounded-2xl border bg-card p-3">
                  {/* Миниатюра */}
                  <div className="h-24 w-24 rounded-lg bg-muted overflow-hidden shrink-0">
                    {i.image_url ? (
                      <img src={i.image_url} alt={i.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-2xl">
                        🛍️
                      </div>
                    )}
                  </div>
                  {/* Основной блок */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <Link
                      to="/product/$id"
                      params={{ id: i.id }}
                      className="text-sm font-medium line-clamp-2 hover:underline"
                    >
                      {i.title}
                    </Link>
                    <div className="mt-auto flex items-center justify-between gap-2">
                      {/* Изменение количества */}
                      <div className="flex items-center gap-1 rounded-lg border">
                        <button
                          onClick={() => setQty(i.id, i.quantity - 1)}
                          className="p-2 hover:bg-accent rounded-l-lg"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{i.quantity}</span>
                        <button
                          onClick={() => setQty(i.id, i.quantity + 1)}
                          disabled={i.quantity >= i.stock}
                          className="p-2 hover:bg-accent rounded-r-lg disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      {/* Цена позиции */}
                      <div className="font-bold">
                        {formatPrice(i.price_kopecks * i.quantity)}
                      </div>
                    </div>
                  </div>
                  {/* Удаление */}
                  <button
                    onClick={() => remove(i.id)}
                    className="self-start p-2 text-muted-foreground hover:text-destructive"
                    aria-label="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Сводка */}
            <div className="rounded-2xl border bg-card p-5 h-fit md:sticky md:top-20">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Товары</span>
                <span>{items.reduce((s, i) => s + i.quantity, 0)} шт.</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-3 mt-3">
                <span>К оплате</span>
                <span>{formatPrice(total)}</span>
              </div>
              <Link
                to="/checkout"
                className="mt-4 flex items-center justify-center rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground hover:opacity-90"
              >
                Оформить заказ
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
