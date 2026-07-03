// Оформление заказа
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import { createOrder } from "@/lib/orders.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

// Определяем маршрут «/checkout»
export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Оформление заказа — BreezeMarket" }] }),
  component: CheckoutPage,
});

// Страница оформления
function CheckoutPage() {
  // Получаем корзину и авторизацию
  const items = useCart((s) => s.items);
  const total = useCart((s) => s.totalKopecks());
  const clear = useCart((s) => s.clear);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  // Оборачиваем серверную функцию, чтобы приложился bearer-токен
  const createOrderFn = useServerFn(createOrder);

  // Состояние формы доставки
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Обработчик отправки формы
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      // Перенаправляем на авторизацию, если пользователь не вошёл
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
      // Отправляем заказ на сервер (тестовая оплата — сразу «Подтверждён»)
      const res = await createOrderFn({
        data: {
          items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
          shipping_name: name,
          shipping_phone: phone,
          shipping_address: address,
          paid: true,
        },
      });
      // Очищаем корзину и переходим на страницу успеха
      clear();
      toast.success("Тестовая оплата прошла успешно!");
      navigate({ to: "/order-success/$id", params: { id: res.id } });
    } catch (err) {
      // Показываем сообщение об ошибке
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Оформление заказа</h1>

        {!loading && !user && (
          // Подсказка о необходимости авторизации
          <div className="rounded-2xl border border-primary/20 bg-accent p-4 mb-6 text-sm">
            Чтобы оформить заказ, нужно{" "}
            <button
              onClick={() => navigate({ to: "/auth" })}
              className="text-primary font-semibold hover:underline"
            >
              войти или зарегистрироваться
            </button>
            .
          </div>
        )}

        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          {/* Форма доставки */}
          <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-5 space-y-4">
            <h2 className="font-semibold">Доставка</h2>
            <div>
              <label className="text-sm text-muted-foreground">Имя получателя</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-lg border bg-background"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Телефон</label>
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 999 000 00 00"
                className="mt-1 w-full h-11 px-3 rounded-lg border bg-background"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Адрес доставки</label>
              <textarea
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="mt-1 w-full px-3 py-2 rounded-lg border bg-background"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Оплачиваем..." : `Оплатить (тест) · ${formatPrice(total)}`}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Демо-режим: реальные деньги не списываются.
            </p>
          </form>

          {/* Сводка */}
          <div className="rounded-2xl border bg-card p-5 h-fit space-y-3">
            <h2 className="font-semibold">Ваш заказ</h2>
            <div className="space-y-2 text-sm">
              {items.map((i) => (
                <div key={i.id} className="flex justify-between gap-2">
                  <span className="line-clamp-1">
                    {i.title} × {i.quantity}
                  </span>
                  <span className="shrink-0">{formatPrice(i.price_kopecks * i.quantity)}</span>
                </div>
              ))}
            </div>
            {/* Разбивка суммы с комиссией платформы */}
            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Товары</span>
                <span>{formatPrice(total - Math.round(total * 0.1))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Комиссия платформы (10%)</span>
                <span>{formatPrice(Math.round(total * 0.1))}</span>
              </div>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-3">
              <span>Итого</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
