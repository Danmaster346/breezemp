// Оформление заказа — шаги, доставка, промокод, детализированный итог
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/use-auth";
import { formatPrice } from "@/lib/format";
import { createOrder } from "@/lib/orders.functions";
import {
  computeDiscountKopecks,
  validatePromoCode,
  type PromoValidationResult,
} from "@/lib/promo.functions";
import {
  SHIPPING_OPTIONS,
  calcShippingCost,
  getShippingOption,
  DEFAULT_SHIPPING_METHOD,
  type ShippingMethod,
} from "@/lib/shipping";
import {
  loadDraft,
  saveDraft,
  loadPromoCode,
  savePromoCode,
  formatPhone,
  isPhoneComplete,
} from "@/lib/checkout-draft";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastOrderPlaced } from "@/lib/toasts";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  ShieldCheck,
  Tag,
  Truck,
  X,
} from "lucide-react";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Оформление заказа — Kupiks" },
      {
        name: "description",
        content: "Оформите заказ на Kupiks: данные получателя, доставка, промокод и оплата.",
      },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: "Оформление заказа — Kupiks" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

// Прогресс-бар шагов оформления
function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Доставка", "Оплата", "Подтверждение"];
  return (
    <ol className="mb-6 flex items-center gap-2 md:gap-3">
      {steps.map((label, idx) => {
        const n = idx + 1;
        const done = n < step;
        const active = n === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 md:gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold transition ${
                  done
                    ? "bg-emerald-600 text-white"
                    : active
                      ? "bg-brand text-brand-foreground"
                      : "bg-surface text-muted-foreground border border-border"
                }`}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : n}
              </span>
              <span
                className={`truncate text-xs md:text-sm ${
                  active ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {n < steps.length && (
              <span className="hidden sm:block h-px flex-1 bg-border" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CheckoutPage() {
  const items = useCart((s) => s.items);
  const subtotal = useCart((s) => s.totalKopecks());
  const clear = useCart((s) => s.clear);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const createOrderFn = useServerFn(createOrder);
  const validatePromoFn = useServerFn(validatePromoCode);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [comment, setComment] = useState("");
  const [method, setMethod] = useState<ShippingMethod>(DEFAULT_SHIPPING_METHOD);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoValidationResult | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Подставляем сохранённые данные получателя и промокод
  useEffect(() => {
    const d = loadDraft();
    setName(d.name);
    setPhone(d.phone);
    setCity(d.city);
    setAddress(d.address);
    setZip(d.zip);
    setComment(d.comment);
    if (SHIPPING_OPTIONS.some((o) => o.id === d.method)) {
      setMethod(d.method as ShippingMethod);
    }
    const savedPromo = loadPromoCode();
    if (savedPromo) setPromoInput(savedPromo);
  }, []);

  // Сохраняем черновик при изменениях
  useEffect(() => {
    saveDraft({ name, phone, city, address, zip, comment, method });
  }, [name, phone, city, address, zip, comment, method]);

  const shippingCost = useMemo(() => calcShippingCost(method, subtotal), [method, subtotal]);
  const discount = promo?.discount_kopecks ?? 0;
  const total = Math.max(0, subtotal - discount) + shippingCost;

  const deliveryFilled =
    name.trim().length > 1 && isPhoneComplete(phone) && city.trim() && address.trim();
  const step: 1 | 2 | 3 = submitting ? 3 : deliveryFilled ? 2 : 1;

  /** Быстрая проверка формата на клиенте — до обращения к серверу. */
  const localPromoError = (code: string): string | null => {
    if (!code) return "Введите промокод";
    if (code.length < 3) return "Промокод слишком короткий — минимум 3 символа";
    if (code.length > 32) return "Промокод слишком длинный — максимум 32 символа";
    if (!/^[A-Z0-9_-]+$/.test(code))
      return "Только латинские буквы, цифры, дефис и подчёркивание";
    if (subtotal <= 0) return "Добавьте товары в корзину, чтобы применить промокод";
    return null;
  };

  /**
   * Проверяет промокод на сервере и применяет его.
   * silent=true — авто-проверка при вводе (без всплывающих уведомлений).
   */
  const applyPromo = async (rawCode?: string, silent = false) => {
    const code = (rawCode ?? promoInput).trim().toUpperCase();
    const localErr = localPromoError(code);
    if (localErr) {
      setPromo(null);
      savePromoCode(null);
      setPromoError(localErr);
      if (!silent && code) toast.error(localErr);
      return false;
    }
    setPromoChecking(true);
    setPromoError(null);
    try {
      const res = await validatePromoFn({ data: { code, subtotal_kopecks: subtotal } });
      setPromo(res);
      savePromoCode(res.code);
      setPromoError(null);
      if (!silent) toast.success(`Промокод «${res.code}» применён`);
      return true;
    } catch (err) {
      const msg = (err as Error).message || "Промокод не действует";
      setPromo(null);
      savePromoCode(null);
      setPromoError(msg);
      if (!silent) toast.error(msg);
      return false;
    } finally {
      setPromoChecking(false);
    }
  };

  // Автопроверка промокода при вводе (с задержкой) — итог пересчитывается сразу
  useEffect(() => {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setPromoError(null);
      if (promo) {
        setPromo(null);
        savePromoCode(null);
      }
      return;
    }
    if (promo?.code === code) return;
    const localErr = localPromoError(code);
    if (localErr) {
      setPromoError(code.length >= 3 ? localErr : null);
      if (promo) {
        setPromo(null);
        savePromoCode(null);
      }
      return;
    }
    const t = setTimeout(() => void applyPromo(code, true), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoInput, subtotal]);

  // Пересчёт применённой скидки при изменении суммы корзины
  useEffect(() => {
    if (!promo) return;
    if (subtotal <= 0) {
      setPromo(null);
      savePromoCode(null);
      setPromoError("Корзина пуста — промокод снят");
      return;
    }
    if (subtotal < promo.min_order_kopecks) {
      setPromo(null);
      setPromoError(
        `Промокод действует от суммы ${formatPrice(promo.min_order_kopecks)} — скидка снята`,
      );
      return;
    }
    const recomputed = computeDiscountKopecks(promo, subtotal);
    if (recomputed !== promo.discount_kopecks) {
      setPromo({ ...promo, discount_kopecks: recomputed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const removePromo = () => {
    setPromo(null);
    setPromoInput("");
    setPromoError(null);
    savePromoCode(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Нужно войти, чтобы оформить заказ");
      navigate({ to: "/auth", search: { redirect: "/checkout" } });
      return;
    }
    if (items.length === 0) {
      toast.error("Корзина пуста");
      return;
    }
    if (!isPhoneComplete(phone)) {
      toast.error("Укажите телефон полностью: +7 (999) 000-00-00");
      return;
    }
    // Собираем адрес в одну строку для сохранения в заказе
    const fullAddress = [zip.trim(), city.trim(), address.trim(), comment.trim() ? `Комментарий: ${comment.trim()}` : ""]
      .filter(Boolean)
      .join(", ");
    setSubmitting(true);
    try {
      const res = await createOrderFn({
        data: {
          items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
          shipping_name: name.trim(),
          shipping_phone: phone.trim(),
          shipping_address: fullAddress,
          shipping_method: method,
          promo_code: promo?.code ?? null,
          paid: true,
        },
      });
      clear();
      savePromoCode(null);
      toastOrderPlaced(res.id);
      navigate({ to: "/order-success/$id", params: { id: res.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "mt-1.5 w-full h-11 px-4 rounded-xl border border-border bg-white text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

  const selectedOption = getShippingOption(method);

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-10 pb-32 md:pb-10">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Оформление заказа</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Заполните данные доставки, выберите способ и подтвердите заказ.
        </p>

        <StepBar step={step} />

        {!loading && !user && (
          <div className="rounded-2xl border border-brand/20 bg-brand-soft p-4 mb-6 text-sm animate-fade-in">
            Чтобы оформить заказ, нужно{" "}
            <button
              onClick={() => navigate({ to: "/auth", search: { redirect: "/checkout" } })}
              className="text-brand font-semibold hover:underline"
            >
              войти или зарегистрироваться
            </button>
            .
          </div>
        )}

        <div className="grid md:grid-cols-[1fr_380px] gap-6">
          {/* Форма */}
          <form id="checkout-form" onSubmit={onSubmit} className="space-y-5">
            {/* Данные получателя */}
            <section className="rounded-2xl border border-border bg-white p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand">
                  <MapPin className="h-4 w-4" />
                </div>
                <h2 className="font-semibold text-lg">Данные доставки</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">ФИО получателя</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Иванов Иван Иванович"
                    autoComplete="name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Телефон</label>
                  <input
                    required
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    onFocus={() => {
                      if (!phone) setPhone("+7 (");
                    }}
                    placeholder="+7 (___) ___-__-__"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Город</label>
                  <input
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Москва"
                    autoComplete="address-level2"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Индекс</label>
                  <input
                    value={zip}
                    onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium">{selectedOption.addressLabel}</label>
                  <input
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={selectedOption.addressPlaceholder}
                    autoComplete="street-address"
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium">
                    Комментарий к заказу{" "}
                    <span className="text-muted-foreground font-normal">(необязательно)</span>
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Код домофона, удобное время доставки…"
                    className="mt-1.5 w-full px-4 py-3 rounded-xl border border-border bg-white text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Данные сохраняются на этом устройстве и подставятся при следующем заказе.
              </p>
            </section>

            {/* Способ доставки */}
            <section className="rounded-2xl border border-border bg-white p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand">
                  <Truck className="h-4 w-4" />
                </div>
                <h2 className="font-semibold text-lg">Способ доставки</h2>
              </div>
              <div className="grid gap-3">
                {SHIPPING_OPTIONS.map((opt) => {
                  const cost = calcShippingCost(opt.id, subtotal);
                  const active = method === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${
                        active
                          ? "border-brand ring-2 ring-brand/20 bg-brand-soft/40"
                          : "border-border hover:border-brand/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        value={opt.id}
                        checked={active}
                        onChange={() => setMethod(opt.id)}
                        className="mt-1 accent-brand"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">
                            <span className="mr-1.5">{opt.emoji}</span>
                            {opt.label}
                          </div>
                          <div className="text-sm font-semibold shrink-0">
                            {cost === 0 ? (
                              <span className="text-emerald-600">Бесплатно</span>
                            ) : (
                              formatPrice(cost)
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {opt.description} · {opt.eta}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Промокод */}
            <section className="rounded-2xl border border-border bg-white p-5 md:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand">
                  <Tag className="h-4 w-4" />
                </div>
                <h2 className="font-semibold text-lg">Промокод</h2>
              </div>
              {promo ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-emerald-700">{promo.code}</div>
                      <div className="text-xs text-emerald-700/80">
                        Скидка{" "}
                        {promo.discount_type === "percent"
                          ? `${promo.discount_value}%`
                          : formatPrice(promo.discount_value)}{" "}
                        · −{formatPrice(promo.discount_kopecks)}
                      </div>
                    </div>
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
                <div>
                  <div className="flex gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) =>
                        setPromoInput(e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 32))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void applyPromo();
                        }
                      }}
                      maxLength={32}
                      aria-invalid={!!promoError}
                      aria-describedby="promo-hint"
                      placeholder="Введите промокод"
                      className={`${inputCls} mt-0 uppercase ${
                        promoError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => void applyPromo()}
                      disabled={promoChecking || !promoInput.trim()}
                      className="h-11 shrink-0 rounded-xl border border-brand bg-white px-4 text-sm font-semibold text-brand hover:bg-brand-soft disabled:opacity-50"
                    >
                      {promoChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Применить"}
                    </button>
                  </div>
                  <p id="promo-hint" className="mt-2 text-xs min-h-4">
                    {promoChecking ? (
                      <span className="text-muted-foreground">Проверяем промокод…</span>
                    ) : promoError ? (
                      <span className="text-red-600">{promoError}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        Скидка применится автоматически после проверки
                      </span>
                    )}
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Попробуйте: <span className="font-mono">WELCOME10</span> — 10% скидка
              </p>
            </section>

            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="hidden md:inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-4 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition"
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
            <p className="hidden md:flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Демо-режим: реальные деньги не списываются
            </p>
          </form>

          {/* Сводка */}
          <aside className="rounded-2xl border border-border bg-white p-5 md:p-6 h-fit md:sticky md:top-24 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-4 w-4 text-brand" />
              <h2 className="font-semibold text-lg">Ваш заказ</h2>
            </div>
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
            <div className="border-t pt-4 mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Товары</span>
                <span className="text-foreground">{formatPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Скидка ({promo?.code})</span>
                  <span>−{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>
                  Доставка · {selectedOption.emoji} {selectedOption.label}
                </span>
                <span
                  className={shippingCost === 0 ? "text-emerald-600 font-medium" : "text-foreground"}
                >
                  {shippingCost === 0 ? "Бесплатно" : formatPrice(shippingCost)}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-3 border-t">
                <span className="font-bold">ИТОГО</span>
                <span className="text-2xl font-extrabold tracking-tight text-foreground">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Мобильная sticky-панель оплаты */}
      <div className="md:hidden fixed bottom-nav inset-x-0 z-30 border-t border-border bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-8px_20px_-8px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground leading-none">К оплате</div>
            <div className="text-lg font-extrabold tracking-tight">{formatPrice(total)}</div>
          </div>
          <button
            type="submit"
            form="checkout-form"
            disabled={submitting || items.length === 0}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Оплачиваем…
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" /> Оплатить
              </>
            )}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
