// Страница корзины — премиальный e-commerce стиль с мобильной sticky-панелью
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/use-auth";
import { useSignInDialog } from "@/lib/pending-cart";
import { formatPrice } from "@/lib/format";
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight, LogIn } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Корзина — BREEZE" }] }),
  component: CartPage,
});

function CartPage() {
  const items = useCart((s) => s.items);
  const remove = useCart((s) => s.remove);
  const setQty = useCart((s) => s.setQty);
  const total = useCart((s) => s.totalKopecks());
  const qtyTotal = items.reduce((s, i) => s + i.quantity, 0);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Клик по «Оформить заказ»: гость → модалка входа, иначе → чекаут
  const goCheckout = () => {
    if (!user) {
      useSignInDialog.getState().show({
        message:
          "Чтобы оформить заказ, войдите в аккаунт. После входа мы вернём вас к оформлению.",
        redirectTo: "/checkout",
      });
      return;
    }
    navigate({ to: "/checkout" });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-10 pb-32 md:pb-10">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Корзина</h1>
          {items.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {qtyTotal} {qtyTotal === 1 ? "товар" : "товара(ов)"} на сумму{" "}
              <span className="font-semibold text-foreground">{formatPrice(total)}</span>
            </p>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white p-10 md:p-16 text-center animate-fade-in">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-brand-soft">
              <ShoppingBag className="h-7 w-7 text-brand" />
            </div>
            <h2 className="text-lg font-semibold">В корзине пока пусто</h2>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">
              Найдите что-нибудь подходящее в каталоге — тысячи товаров от продавцов со всей России.
            </p>
            <Link
              to="/catalog"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 shadow-sm hover:shadow-md transition"
            >
              Открыть каталог <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_340px] gap-6">
            {/* Список позиций */}
            <div className="space-y-3">
              {items.map((i) => (
                <div
                  key={i.id}
                  className="flex gap-3 rounded-2xl border border-border bg-white p-3 md:p-4 hover:border-brand/30 transition"
                >
                  <Link
                    to="/product/$id"
                    params={{ id: i.id }}
                    className="h-24 w-24 md:h-28 md:w-28 rounded-xl bg-surface overflow-hidden shrink-0"
                  >
                    {i.image_url ? (
                      <img src={i.image_url} alt={i.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-2xl opacity-40">🛍️</div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <Link
                      to="/product/$id"
                      params={{ id: i.id }}
                      className="text-sm md:text-base font-medium line-clamp-2 hover:text-brand transition"
                    >
                      {i.title}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatPrice(i.price_kopecks)} / шт
                    </div>
                    <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-full border border-border bg-surface">
                        <button
                          onClick={() => setQty(i.id, i.quantity - 1)}
                          className="h-8 w-8 grid place-items-center rounded-full hover:bg-white transition"
                          aria-label="Уменьшить"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{i.quantity}</span>
                        <button
                          onClick={() => setQty(i.id, i.quantity + 1)}
                          disabled={i.quantity >= i.stock}
                          className="h-8 w-8 grid place-items-center rounded-full hover:bg-white disabled:opacity-40 transition"
                          aria-label="Увеличить"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="text-base md:text-lg font-bold tracking-tight">
                        {formatPrice(i.price_kopecks * i.quantity)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(i.id)}
                    className="self-start p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition"
                    aria-label="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Сводка (desktop) */}
            <div className="hidden md:block rounded-2xl border border-border bg-white p-6 h-fit sticky top-24 shadow-sm">
              <h2 className="font-semibold text-lg mb-4">Ваш заказ</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Товары ({qtyTotal})</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Доставка</span>
                  <span className="text-emerald-600 font-medium">Бесплатно</span>
                </div>
              </div>
              <div className="flex justify-between items-baseline border-t pt-4 mt-4">
                <span className="font-semibold">Итого</span>
                <span className="text-2xl font-extrabold tracking-tight">{formatPrice(total)}</span>
              </div>
              {!user && (
                <div className="mt-5 rounded-xl border border-brand/20 bg-brand-soft px-3 py-2.5 text-xs text-foreground/80 flex items-start gap-2">
                  <LogIn className="h-4 w-4 text-brand mt-0.5 shrink-0" />
                  <span>Чтобы оформить заказ, войдите в аккаунт.</span>
                </div>
              )}
              <button
                type="button"
                onClick={goCheckout}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 font-semibold text-brand-foreground hover:bg-brand/90 shadow-sm hover:shadow-md transition"
              >
                {user ? "Оформить заказ" : "Войти и оформить"} <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-xs text-muted-foreground text-center">
                Демо-оплата: реальные средства не списываются
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Мобильная sticky-панель оформления */}
      {items.length > 0 && (
        <div className="md:hidden fixed bottom-nav inset-x-0 z-30 border-t border-border bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-8px_20px_-8px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-muted-foreground leading-none">Итого</div>
              <div className="text-lg font-extrabold tracking-tight">{formatPrice(total)}</div>
            </div>
            <button
              type="button"
              onClick={goCheckout}
              className="flex-1 flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 shadow-sm transition"
            >
              {user ? "Оформить" : "Войти"} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
