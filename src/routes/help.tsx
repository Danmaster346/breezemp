// Страница помощи: FAQ по доставке, оплате и возврату.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ChevronDown, LifeBuoy, MessageCircle, Truck } from "lucide-react";

const FAQ = [
  {
    q: "Сколько идёт доставка и сколько она стоит?",
    a: "Срок зависит от выбранного способа: СДЭК и Яндекс Доставка — обычно 2–5 дней, пункт выдачи — 3–7 дней. Стоимость рассчитывается автоматически при оформлении заказа, а при крупной сумме заказа доставка бывает бесплатной.",
  },
  {
    q: "Как отследить мой заказ?",
    a: "Откройте страницу «Отслеживание заказа» и введите номер заказа — вы увидите текущий статус, этапы и состав заказа. Заказы также доступны в личном кабинете в разделе «Мои заказы».",
  },
  {
    q: "Какие способы оплаты доступны?",
    a: "Оплата производится при оформлении заказа. Итоговая сумма включает стоимость товаров, доставку и учитывает промокод, если вы его применили.",
  },
  {
    q: "Как использовать промокод?",
    a: "Введите код в поле «Промокод» на странице оформления заказа и нажмите «Применить». Если код активен и сумма заказа подходит под условия, скидка сразу отобразится в сводке.",
  },
  {
    q: "Можно ли вернуть товар?",
    a: "Да. Откройте заказ в личном кабинете, выберите позицию и оформите возврат, указав причину и при необходимости фотографии. Продавец и служба поддержки рассмотрят заявку.",
  },
  {
    q: "Что делать, если товар пришёл повреждённым?",
    a: "Сфотографируйте товар и упаковку, оформите возврат с приложением фото или напишите продавцу в чат из карточки заказа. Мы поможем решить вопрос.",
  },
  {
    q: "Как связаться с продавцом?",
    a: "На странице товара или в заказе нажмите «Написать продавцу» — переписка появится в разделе «Сообщения» вашего личного кабинета.",
  },
];

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Помощь и частые вопросы — Kupiks" },
      {
        name: "description",
        content:
          "Ответы на частые вопросы о доставке, оплате, промокодах и возврате товаров на маркетплейсе Kupiks.",
      },
      { property: "og:title", content: "Помощь и частые вопросы — Kupiks" },
      {
        property: "og:description",
        content: "Доставка, оплата, промокоды и возврат товаров — всё в одном разделе.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://kupiks-marketplace.ru/help" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://kupiks-marketplace.ru/help" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 text-brand px-3 py-1.5 text-xs font-semibold mb-4">
          <LifeBuoy className="h-3.5 w-3.5" /> Центр помощи
        </div>
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-2">
          Чем можем помочь?
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mb-8">
          Собрали ответы на самые частые вопросы о заказах, доставке, оплате и возврате.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-10">
          <Link
            to="/track-order"
            className="rounded-2xl border border-border bg-card p-4 hover:border-brand/50 ui-transition"
          >
            <Truck className="h-5 w-5 text-brand mb-2" />
            <div className="font-semibold">Отследить заказ</div>
            <div className="text-sm text-muted-foreground">Статус и этапы по номеру заказа</div>
          </Link>
          <Link
            to="/contacts"
            className="rounded-2xl border border-border bg-card p-4 hover:border-brand/50 ui-transition"
          >
            <MessageCircle className="h-5 w-5 text-brand mb-2" />
            <div className="font-semibold">Написать нам</div>
            <div className="text-sm text-muted-foreground">Форма обратной связи</div>
          </Link>
        </div>

        <h2 className="text-lg md:text-2xl font-bold mb-4">Частые вопросы</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-3 text-left px-4 py-4 hover:bg-surface ui-transition"
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-sm md:text-base">{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-sm md:text-base leading-relaxed text-muted-foreground">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
