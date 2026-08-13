import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Политика конфиденциальности — Kupiks" },
      { name: "description", content: "Как маркетплейс Kupiks собирает, использует и защищает персональные данные покупателей и продавцов." },
      { property: "og:title", content: "Политика конфиденциальности — Kupiks" },
      { property: "og:description", content: "Обработка персональных данных на маркетплейсе Kupiks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "index,follow" },
      { property: "og:url", content: "https://kupiks-marketplace.ru/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://kupiks-marketplace.ru/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Политика конфиденциальности</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Действует с момента публикации. Настоящий документ описывает, как маркетплейс Kupiks
          (далее — «Kupiks», «мы») обрабатывает персональные данные пользователей — покупателей
          и продавцов.
        </p>

        <div className="space-y-6 text-sm md:text-base leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2">1. Общие положения</h2>
            <p>
              Регистрируясь на Kupiks и используя сервис, пользователь подтверждает, что
              ознакомлен с настоящей Политикой и даёт согласие на обработку своих персональных
              данных на условиях, изложенных ниже. Если пользователь не согласен с Политикой, ему
              следует воздержаться от регистрации и использования сервиса.
            </p>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2">2. Какие данные мы собираем</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Учётные данные: имя или название магазина, email, пароль (в зашифрованном виде).</li>
              <li>Контактные данные: номер телефона, адрес доставки, ПВЗ.</li>
              <li>Данные о заказах: состав, суммы, статусы, история покупок и продаж.</li>
              <li>Данные о товарах (для продавцов): описания, фото, цены, остатки.</li>
              <li>Отзывы, оценки, сообщения в чате, вложения к ним.</li>
              <li>Технические данные: IP-адрес, тип устройства, cookies, идентификаторы сессии.</li>
            </ul>
            <p className="mt-2">
              Платёжные данные (номер карты, CVC) на серверах Kupiks не сохраняются — платежи
              обрабатывает подключённый платёжный провайдер.
            </p>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2">3. Цели обработки</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Регистрация и аутентификация пользователя.</li>
              <li>Оформление заказов, приём оплаты и организация доставки.</li>
              <li>Выплаты продавцам за проданные товары.</li>
              <li>Поддержка пользователей, разрешение споров и возвратов.</li>
              <li>Обеспечение безопасности, предотвращение мошенничества.</li>
              <li>Улучшение сервиса, аналитика, рекомендации.</li>
              <li>Информационные и сервисные уведомления.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2">4. Передача данных третьим лицам</h2>
            <p>
              Мы передаём минимально необходимый объём данных: службам доставки (СДЭК, Яндекс и
              др.) — для доставки заказа; платёжным провайдерам — для проведения оплаты и
              выплат; провайдерам инфраструктуры и уведомлений — для работы сервиса. Данные
              покупателя передаются продавцу только в объёме, необходимом для исполнения заказа
              (имя, адрес доставки, состав заказа).
            </p>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2">5. Хранение и безопасность</h2>
            <p>
              Данные хранятся на защищённой инфраструктуре. Доступ сотрудников ограничен и
              журналируется. Пароли хранятся в виде хэшей. Мы храним данные, пока это необходимо
              для целей, указанных выше, и в сроки, предусмотренные законом (в том числе для
              бухгалтерии и разрешения споров).
            </p>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2">6. Cookies и аналитика</h2>
            <p>
              Мы используем cookies и аналогичные технологии для аутентификации, сохранения
              настроек, корзины и анализа посещаемости. Отключение cookies может ограничить
              функциональность сервиса.
            </p>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2">7. Права пользователя</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Получить доступ к своим данным и запросить их копию.</li>
              <li>Уточнить, исправить или дополнить данные в личном кабинете.</li>
              <li>Отозвать согласие и запросить удаление аккаунта.</li>
              <li>Обратиться с жалобой в уполномоченный орган по защите персональных данных.</li>
            </ul>
            <p className="mt-2">
              Запросы направляются через раздел поддержки в личном кабинете или на контактный
              email маркетплейса.
            </p>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2">8. Изменения Политики</h2>
            <p>
              Мы можем обновлять Политику. Актуальная версия всегда доступна на этой странице.
              Существенные изменения мы дополнительно доводим до пользователей в интерфейсе
              сервиса.
            </p>
          </section>

          <section>
            <h2 className="text-lg md:text-xl font-semibold mb-2">9. Контакты</h2>
            <p>
              По вопросам обработки персональных данных обращайтесь через раздел поддержки
              Kupiks в личном кабинете.
            </p>
          </section>
        </div>

        <div className="mt-10">
          <Link to="/" className="text-sm text-brand hover:underline">
            ← Вернуться на главную
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
