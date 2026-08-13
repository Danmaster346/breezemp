// Страница корзины — сводка заказа, промокод, недавно просмотренные
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastRemovedFromCart } from "@/lib/toasts";
import { AppLayout } from "@/components/AppLayout";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/use-auth";
import { useSignInDialog } from "@/lib/pending-cart";
import { formatPrice } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { getRecentlyViewed } from "@/lib/recently-viewed";
import { loadPromoCode, savePromoCode } from "@/lib/checkout-draft";
import { validatePromoCode, type PromoValidationResult } from "@/lib/promo.functions";
import { FREE_SHIPPING_FROM_KOPECKS } from "@/lib/shipping";
import {
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  ArrowRight,
  LogIn,
  Tag,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Корзина — Kupiks" },
      {
        name: "description",
        content: "Ваша корзина на Kupiks: проверьте товары и оформите заказ с доставкой по России.",
      },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: "Корзина — Kupiks" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartPage,
});

const COURIER_COST_KOPECKS = 30000;

type MiniProduct = {
  id: string;
  title: string;
  price_kopecks: number;
  image_url: string | null;
};

function CartPage() {
  const items = useCart((s) => s.items);
  const remove = useCart((s) => s.remove);
  const setQty = useCart((s) => s.setQty);
  const syncStock = useCart((s) => s.syncStock);

  const addBack = useCart((s) => s.add);

  // Удаление позиции с возможностью отмены (5 секунд)
  const removeWithUndo = (id: string) => {
    const item = items.find((i) => i.id === id);
    remove(id);
    if (!item) return;
    toastRemovedFromCart(item.title, () => {
      const { quantity, ...rest } = item;
      addBack(rest, quantity);
    });
  };
  const subtotal = useCart((s) => s.totalKopecks());
  const qtyTotal = items.reduce((s, i) => s + i.quantity, 0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const validatePromoFn = useServerFn(validatePromoCode);

  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoValidationResult | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);

  // Актуальные остатки по товарам корзины (проверяем при изменении количества)
  const itemIds = useMemo(() => items.map((i) => i.id).sort(), [items]);
  const stockQuery = useQuery({
    queryKey: ["cart-stock", itemIds.join(",")],
    enabled: itemIds.length > 0,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, stock, is_active")
        .in("id", itemIds);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        map[row.id] = row.is_active ? (row.stock ?? 0) : 0;
      }
      return map;
    },
  });

  // Синхронизируем остатки в корзине, когда данные обновились
  useEffect(() => {
    if (stockQuery.data) syncStock(stockQuery.data);
  }, [stockQuery.data, syncStock]);

  // Изменение количества с проверкой доступного остатка и уведомлением
  const changeQty = async (id: string, next: number) => {
    if (next < 1) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Берём свежий остаток из БД, при ошибке — то, что уже есть в корзине
    let stock = item.stock;
    const { data, error } = await supabase
      .from("products")
      .select("stock, is_active")
      .eq("id", id)
      .maybeSingle();
    if (!error && data) {
      stock = data.is_active ? (data.stock ?? 0) : 0;
      syncStock({ [id]: stock });
    }

    if (stock <= 0) {
      toast.error("Товар закончился", { description: item.title });
      return;
    }
    if (next > stock) {
      setQty(id, stock);
      toast.warning(`Доступно только ${stock} шт.`, { description: item.title });
      return;
    }
    setQty(id, next);
  };

  // Имена продавцов для позиций корзины

  const sellerIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.seller_id).filter(Boolean))),
    [items],
  );
  const sellersQuery = useQuery({
    queryKey: ["cart-sellers", sellerIds.join(",")],
    enabled: sellerIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_profiles")
        .select("user_id, shop_name")
        .in("user_id", sellerIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        if (row.shop_name) map[row.user_id] = row.shop_name;
      }
      return map;
    },
  });
  const sellerNames = sellersQuery.data ?? {};

  // Недавно просмотренные — только для пустой корзины
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    setRecentIds(getRecentlyViewed());
  }, []);
  const recentQuery = useQuery({
    queryKey: ["cart-recently-viewed", recentIds.join(",")],
    enabled: recentIds.length > 0 && items.length === 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, price_kopecks, image_url")
        .in("id", recentIds)
        .eq("is_active", true);
      if (error) throw error;
      const rows = (data ?? []) as MiniProduct[];
      return recentIds
        .map((rid) => rows.find((r) => r.id === rid))
        .filter((r): r is MiniProduct => !!r);
    },
  });

  // Восстановление ранее применённого промокода
  useEffect(() => {
    const saved = loadPromoCode();
    if (saved) setPromoInput(saved);
  }, []);

  const discount = promo?.discount_kopecks ?? 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  const shipping = afterDiscount >= FREE_SHIPPING_FROM_KOPECKS ? 0 : COURIER_COST_KOPECKS;
  const total = afterDiscount + shipping;

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoChecking(true);
    try {
      const res = await validatePromoFn({ data: { code, subtotal_kopecks: subtotal } });
      setPromo(res);
      savePromoCode(res.code);
      toast.success(`Промокод «${res.code}» применён`);
    } catch (err) {
      setPromo(null);
      savePromoCode(null);
      toast.error((err as Error).message || "Промокод не действует");
    } finally {
      setPromoChecking(false);
    }
  };

  const removePromo = () => {
    setPromo(null);
    setPromoInput("");
    savePromoCode(null);
  };

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

  // Блок сводки заказа (используется и на десктопе, и на мобиле)
  const summary = (
    <div className="rounded-2xl border border-border bg-white p-5 md:p-6 shadow-sm">
      <h2 className="font-semibold text-lg mb-4">Сводка заказа</h2>
      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Товары ({qtyTotal})</span>
          <span className="font-medium">{formatPrice(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>Скидка ({promo?.code})</span>
            <span>−{formatPrice(discount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Доставка</span>
          <span className={shipping === 0 ? "text-emerald-600 font-medium" : "font-medium"}>
            {shipping === 0 ? "Бесплатно" : formatPrice(shipping)}
          </span>
        </div>
        {shipping > 0 && (
          <p className="text-xs text-muted-foreground">
            Бесплатная доставка от {formatPrice(FREE_SHIPPING_FROM_KOPECKS)} — добавьте товаров ещё
            на {formatPrice(FREE_SHIPPING_FROM_KOPECKS - afterDiscount)}
          </p>
        )}
      </div>

      <div className="flex justify-between items-baseline border-t pt-4 mt-4">
        <span className="font-bold">ИТОГО</span>
        <span className="text-2xl font-extrabold tracking-tight">{formatPrice(total)}</span>
      </div>

      {/* Промокод */}
      <div className="mt-5">
        {promo ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-semibold">{promo.code}</span>
            </div>
            <button
              type="button"
              onClick={removePromo}
              className="p-1.5 rounded-full hover:bg-emerald-100 text-emerald-700"
              aria-label="Удалить промокод"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="Промокод"
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-border bg-white text-sm uppercase outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <button
              type="button"
              onClick={applyPromo}
              disabled={promoChecking || !promoInput.trim()}
              className="h-11 shrink-0 rounded-xl border border-brand bg-white px-4 text-sm font-semibold text-brand hover:bg-brand-soft disabled:opacity-50"
            >
              {promoChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Применить"}
            </button>
          </div>
        )}
      </div>

      {!user && (
        <div className="mt-4 rounded-xl border border-brand/20 bg-brand-soft px-3 py-2.5 text-xs text-foreground/80 flex items-start gap-2">
          <LogIn className="h-4 w-4 text-brand mt-0.5 shrink-0" />
          <span>Чтобы оформить заказ, войдите в аккаунт.</span>
        </div>
      )}

      <button
        type="button"
        onClick={goCheckout}
        className="mt-4 w-full flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-4 text-base font-bold text-white hover:bg-emerald-700 shadow-sm hover:shadow-md transition"
      >
        {user ? "Оформить заказ" : "Войти и оформить"} <ArrowRight className="h-4 w-4" />
      </button>
      <p className="mt-3 text-xs text-muted-foreground text-center">
        Демо-оплата: реальные средства не списываются
      </p>
    </div>
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-10 pb-32 md:pb-10">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Корзина</h1>
          {items.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {qtyTotal} {qtyTotal === 1 ? "товар" : "товара(ов)"} на сумму{" "}
              <span className="font-semibold text-foreground">{formatPrice(subtotal)}</span>
            </p>
          )}
        </div>

        {items.length === 0 ? (
          <div className="animate-fade-in">
            <div className="rounded-2xl border border-dashed border-border bg-white p-10 md:p-16 text-center">
              <div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full bg-brand-soft">
                <ShoppingCart className="h-11 w-11 text-brand" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold">Корзина пуста</h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                Найдите что-нибудь подходящее в каталоге — тысячи товаров от продавцов со всей
                России.
              </p>
              <Link
                to="/catalog"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 shadow-sm hover:shadow-md transition"
              >
                Перейти в каталог <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {(recentQuery.data?.length ?? 0) > 0 && (
              <section className="mt-10">
                <h2 className="text-lg font-bold mb-4">Недавно просмотренные</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                  {recentQuery.data!.map((p) => (
                    <Link
                      key={p.id}
                      to="/product/$id"
                      params={{ id: p.id }}
                      className="group rounded-2xl border border-border bg-white overflow-hidden hover:border-brand/40 hover:shadow-md transition"
                    >
                      <div className="aspect-square bg-surface overflow-hidden">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.title}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        ) : (
                          <div className="h-full w-full grid place-items-center text-3xl opacity-40">
                            🛍️
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="text-sm line-clamp-2 min-h-10">{p.title}</div>
                        <div className="mt-1 font-bold">{formatPrice(p.price_kopecks)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_360px] gap-6">
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
                      <img
                        src={i.image_url}
                        alt={i.title}
                        width={112}
                        height={112}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-2xl opacity-40">
                        🛍️
                      </div>
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
                    {sellerNames[i.seller_id] && (
                      <Link
                        to="/seller/$id"
                        params={{ id: i.seller_id }}
                        className="text-xs text-muted-foreground mt-0.5 hover:text-brand transition w-fit"
                      >
                        Продавец: {sellerNames[i.seller_id]}
                      </Link>
                    )}
                    <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-full border border-border bg-surface">
                        <button
                          onClick={() => changeQty(i.id, i.quantity - 1)}
                          className="h-8 w-8 grid place-items-center rounded-full hover:bg-white transition"
                          aria-label="Уменьшить"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{i.quantity}</span>
                        <button
                          onClick={() => changeQty(i.id, i.quantity + 1)}
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
                    onClick={() => removeWithUndo(i.id)}
                    className="self-start p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition"
                    aria-label="Удалить"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {/* Сводка на мобиле — под списком товаров */}
              <div className="md:hidden pt-3">{summary}</div>
            </div>

            {/* Сводка на десктопе — правая колонка */}
            <div className="hidden md:block h-fit sticky top-24">{summary}</div>
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
              className="flex-1 flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 shadow-sm transition"
            >
              {user ? "Оформить" : "Войти"} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
