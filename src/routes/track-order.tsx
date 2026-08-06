// Публичная страница отслеживания заказа по номеру.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppLayout } from "@/components/AppLayout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { OrderStepper } from "@/components/tracking/OrderStepper";
import { formatPrice } from "@/lib/format";
import { STATUS_BADGE, STATUS_LABELS } from "@/lib/order-status";
import { getOrderTracking } from "@/lib/tracking.functions";
import { Search, PackageSearch, MapPin, CalendarClock, Truck, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/track-order")({
  validateSearch: z.object({ order: z.string().trim().max(40).optional() }),
  head: () => ({
    meta: [
      { title: "Отслеживание заказа — Kupiks" },
      {
        name: "description",
        content:
          "Узнайте, где ваш заказ: введите номер заказа и посмотрите статус, этапы доставки и ожидаемую дату получения.",
      },
      { property: "og:title", content: "Отслеживание заказа — Kupiks" },
      {
        property: "og:description",
        content: "Введите номер заказа, чтобы увидеть статус и этапы доставки.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:url", content: "https://breezemp.lovable.app/track-order" },
    ],
    links: [{ rel: "canonical", href: "https://breezemp.lovable.app/track-order" }],
  }),
  component: TrackOrderPage,
});

const fmtDay = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

function TrackOrderPage() {
  const { order } = Route.useSearch();
  const navigate = useNavigate();
  const track = useServerFn(getOrderTracking);
  const [value, setValue] = useState(order ?? "");

  useEffect(() => {
    setValue(order ?? "");
  }, [order]);

  const code = (order ?? "").trim();

  const q = useQuery({
    queryKey: ["order-tracking", code],
    enabled: code.length >= 4,
    queryFn: () => track({ data: { code } }),
    staleTime: 30_000,
    retry: false,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (v.length < 4) return;
    navigate({ to: "/track-order", search: { order: v } });
  };

  const data = q.data;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
        <Breadcrumbs items={[{ label: "Отслеживание заказа" }]} />

        <div className="mt-3 mb-6">
          <h1 className="font-display text-2xl md:text-4xl font-extrabold tracking-tight">
            Отслеживание заказа
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Введите номер заказа — например <span className="font-mono">A3F91B2C</span>. Номер
            указан в письме о заказе и в разделе{" "}
            <Link to="/account" className="text-brand font-medium hover:underline">
              «Мои заказы»
            </Link>
            .
          </p>
        </div>

        {/* Поиск */}
        <form
          onSubmit={submit}
          className="rounded-2xl border bg-card p-3 sm:p-4 flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Номер заказа"
              autoComplete="off"
              aria-label="Номер заказа"
              className="w-full h-12 pl-11 pr-3 rounded-xl border bg-background font-mono uppercase tracking-wider text-sm outline-none focus:border-brand ui-transition"
            />
          </div>
          <button
            type="submit"
            disabled={value.trim().length < 4}
            className="h-12 px-6 rounded-xl bg-brand text-brand-foreground font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 ui-transition"
          >
            <Search className="h-4 w-4" strokeWidth={2.25} />
            Найти
          </button>
        </form>

        {/* Результат */}
        {code.length >= 4 && (
          <div className="mt-6">
            {q.isLoading ? (
              <div className="rounded-2xl border bg-card p-6 animate-pulse space-y-4">
                <div className="h-5 w-40 bg-muted rounded" />
                <div className="h-16 bg-muted rounded" />
                <div className="h-24 bg-muted rounded" />
              </div>
            ) : q.isError || !data || !data.found ? (
              <div className="rounded-2xl border bg-card p-6 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-700">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="mt-3 text-lg font-bold">Заказ не найден, проверьте номер</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Проверьте, что номер введён полностью и без лишних символов.
                </p>
                <Link
                  to="/account"
                  className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-semibold hover:bg-accent ui-transition"
                >
                  Мои заказы в личном кабинете
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Шапка заказа */}
                <div className="rounded-2xl border bg-card p-4 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Заказ</div>
                      <div className="font-mono text-xl font-bold">№{data.code}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        от {fmtDay(data.created_at)}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[data.status]}`}
                    >
                      {STATUS_LABELS[data.status]}
                    </span>
                  </div>

                  {(data.status === "cancelled" || data.status === "returned") && (
                    <div className="mt-4 rounded-xl bg-muted p-3 text-sm">
                      {data.status === "cancelled"
                        ? "Заказ отменён — доставка не выполняется."
                        : "По заказу оформлен возврат."}
                    </div>
                  )}

                  <div className="mt-6">
                    <OrderStepper steps={data.steps} />
                  </div>

                  {data.eta_date && data.status !== "received" && (
                    <div className="mt-6 flex items-center gap-2 rounded-xl bg-surface p-3 text-sm">
                      <CalendarClock className="h-4 w-4 text-brand shrink-0" />
                      <span>
                        Ожидаемая доставка:{" "}
                        <span className="font-semibold">{fmtDay(data.eta_date)}</span>{" "}
                        <span className="text-muted-foreground">
                          (ориентировочно, {data.eta_label})
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Товары */}
                <div className="rounded-2xl border bg-card p-4 sm:p-6">
                  <h2 className="text-sm font-bold mb-3">Состав заказа</h2>
                  <div className="space-y-3">
                    {data.items.map((it, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-surface">
                          {it.image_url ? (
                            <img
                              src={it.image_url}
                              alt={it.title}
                              width={96}
                              height={96}
                              loading="lazy"
                              decoding="async"
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-muted-foreground">
                              <PackageSearch className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium line-clamp-2">{it.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {it.quantity} шт · {formatPrice(it.price_kopecks)}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE[it.status]}`}
                            >
                              {STATUS_LABELS[it.status]}
                            </span>
                            {it.tracking_number && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Truck className="h-3 w-3" />
                                {it.shipping_carrier ?? "Трек"} · {it.tracking_number}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-bold shrink-0">
                          {formatPrice(it.price_kopecks * it.quantity)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 border-t pt-3 space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Доставка</span>
                      <span>
                        {data.shipping_cost_kopecks === 0
                          ? "бесплатно"
                          : formatPrice(data.shipping_cost_kopecks)}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-bold">
                      <span>Итого</span>
                      <span>{formatPrice(data.total_kopecks)}</span>
                    </div>
                  </div>
                </div>

                {/* Доставка */}
                <div className="rounded-2xl border bg-card p-4 sm:p-6">
                  <h2 className="text-sm font-bold mb-3">Доставка</h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <Truck className="h-4 w-4 mt-0.5 text-brand shrink-0" />
                      <span>{data.shipping_method_label}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 text-brand shrink-0" />
                      <span>
                        {data.shipping_address_masked}
                        <span className="block text-xs text-muted-foreground">
                          Полный адрес виден в личном кабинете
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* История событий */}
                {data.history.length > 0 && (
                  <div className="rounded-2xl border bg-card p-4 sm:p-6">
                    <h2 className="text-sm font-bold mb-3">История заказа</h2>
                    <ol className="space-y-3">
                      {data.history.map((h, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                          <span className="flex-1">{h.label}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {fmtDateTime(h.date)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
