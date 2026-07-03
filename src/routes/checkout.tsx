// Оформление заказа — премиальный e-commerce стиль
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import { createOrder } from "@/lib/orders.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CreditCard, Loader2, ShieldCheck, Truck } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Оформление заказа — BREEZE" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const items = useCart((s) => s.items);
  const total = useCart((s) => s.totalKopecks());
  const clear = useCart((s) => s.clear);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const createOrderFn = useServerFn(createOrder);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Нужно войти, чтобы оформить заказ");
      navigate({ to: "/auth" });
      return;
    }
    if (items.length === 0) {
      toast.error("Корзина пуста");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createOrderFn({
        data: {
          items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
          shipping_name: name,
          shipping_phone: phone,
          shipping_address: address,
          paid: true,
        },
      });
      clear();
      toast.success("Тестовая оплата прошла успешно!");
      navigate({ to: "/order-success/$id", params: { id: res.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "mt-1.5 w-full h-11 px-4 rounded-xl border border-border bg-white text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Оформление заказа</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Заполните адрес доставки — и мы сразу проведём демо-оплату.
        </p>

        {!loading && !user && (
          <div className="rounded-2xl border border-brand/20 bg-brand-soft p-4 mb-6 text-sm animate-fade-in">
            Чтобы оформить заказ, нужно{" "}
            <button
              onClick={() => navigate({ to: "/auth" })}
              className="text-brand font-semibold hover:underline"
            >
              войти или зарегистрироваться
            </button>
            .
          </div>
        )}

        <div className="grid md:grid-cols-[1fr_360px] gap-6">
          {/* Форма доставки */}
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-border bg-white p-5 md:p-6 space-y-5 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand">
                <Truck className="h-4 w-4" />
              </div>
              <h2 className="font-semibold text-lg">Доставка</h2>
            </div>

            <div>
              <label className="text-sm font-medium">Имя получателя</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Иван Иванов"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Телефон</label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 999 000 00 00"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Адрес доставки</label>
              <textarea
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="Город, улица, дом, квартира, индекс"
                className="mt-1.5 w-full px-4 py-3 rounded-xl border border-border bg-white text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3.5 text-base font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Оплачиваем…
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" /> Оплатить {formatPrice(total)}
                </>
              )}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Демо-режим: реальные деньги не списываются
            </p>
          </form>

          {/* Сводка */}
          <div className="rounded-2xl border border-border bg-white p-5 md:p-6 h-fit md:sticky md:top-24 shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Ваш заказ</h2>
            <div className="space-y-3 text-sm max-h-64 overflow-auto pr-1 -mr-1">
              {items.map((i) => (
                <div key={i.id} className="flex gap-3">
                  <div className="h-12 w-12 rounded-lg bg-surface overflow-hidden shrink-0">
                    {i.image_url && (
                      <img src={i.image_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm line-clamp-1">{i.title}</div>
                    <div className="text-xs text-muted-foreground">× {i.quantity}</div>
                  </div>
                  <div className="text-sm font-semibold shrink-0">
                    {formatPrice(i.price_kopecks * i.quantity)}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Доставка</span>
                <span className="text-emerald-600 font-medium">Бесплатно</span>
              </div>
              <div className="flex justify-between items-baseline pt-2">
                <span className="font-semibold">Итого</span>
                <span className="text-2xl font-extrabold tracking-tight text-foreground">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
