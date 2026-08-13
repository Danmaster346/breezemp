// SEO-блок главной: H1, текст для поисковиков и ссылки на популярные разделы.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";

export function HomeSeoText({
  categories,
}: {
  categories: { slug: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-12 pb-12 md:pt-16">
      <div className="rounded-3xl bg-surface p-6 md:p-10">
        <h1 className="font-display text-xl font-extrabold tracking-tight md:text-2xl">
          Kupiks — маркетплейс товаров для дома, отдыха и стиля
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          В Kupiks собраны товары от проверенных продавцов: мебель и текстиль для дома, техника,
          товары для отдыха, одежда и аксессуары. Мы показываем честные цены без скрытых наценок,
          рейтинги и реальные отзывы покупателей с фото — чтобы выбор занимал минуты.
        </p>

        {open && (
          <div className="mt-3 max-w-3xl space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Доставка работает по всей России: курьером до двери, в пункты выдачи и постаматы.
              Стоимость и срок рассчитываются в корзине, а от 3000 ₽ доставка бесплатная. Оплатить
              заказ можно картой или при получении, а статус посылки виден в разделе «Отследить
              заказ».
            </p>
            <p>
              Каждый товар проходит модерацию, а обмен и возврат возможны в течение 14 дней. Если
              нужна помощь с выбором — напишите продавцу прямо из карточки товара: чат и история
              переписки хранятся в личном кабинете.
            </p>
            <p>
              Продавцам Kupiks даёт кабинет с аналитикой, складом, управлением заказами и выплатами:
              вы видите выручку, конверсию и остатки в реальном времени.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-strong"
        >
          {open ? "Свернуть" : "Читать далее"}
          <ChevronDown className={`h-4 w-4 ui-transition ${open ? "rotate-180" : ""}`} />
        </button>

        {categories.length > 0 && (
          <>
            <div className="mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Популярные разделы
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {categories.slice(0, 12).map((c) => (
                <li key={c.slug}>
                  <Link
                    to="/catalog"
                    search={{ category: c.slug }}
                    className="inline-flex rounded-full bg-card px-3 py-1.5 text-xs font-semibold hairline hover:text-brand ui-transition"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
