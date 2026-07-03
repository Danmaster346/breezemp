# План: Маркетплейс «BreezeMarket»

Простой многовендорный маркетплейс в духе Wildberries, на русском языке, с современным мобильным-friendly дизайном.

## Стек
- TanStack Start + React + Tailwind v4 + shadcn/ui
- Lovable Cloud (Supabase) — БД, авторизация email+пароль
- Framer Motion — лёгкие анимации
- Русский язык интерфейса, комментарии в коде на русском на каждой строке

## Дизайн
- Светлая тема, акцент — тёплый фиолетово-розовый (в духе WB), крупные карточки товаров, скругления, мягкие тени.
- Мобильная адаптация: нижняя навигация (Каталог/Поиск/Корзина/Кабинет) на мобильных, шапка + грид на десктопе.
- Grid каталога: 2 колонки моб., 3–5 колонок десктоп.

## Роли и авторизация
- Email + пароль (без подтверждения email для скорости).
- Роли хранятся в отдельной таблице `user_roles` (enum `buyer` | `seller`) — через `has_role()` security-definer.
- При регистрации выбор роли: «Я покупаю» / «Я продаю».

## Схема БД (миграции)
- `profiles` (id → auth.users, full_name, phone) + триггер на создание.
- `app_role` enum: `buyer`, `seller`, `admin`.
- `user_roles` (user_id, role) + `has_role()`.
- `categories` (id, slug, name) — предзаполненные (Электроника, Одежда, Дом, Красота, Спорт, Детям).
- `products` (id, seller_id, category_id, title, description, price_kopecks, stock, image_url, created_at, is_active).
- `orders` (id, buyer_id, total_kopecks, commission_kopecks, status, created_at, shipping_name, shipping_phone, shipping_address).
- `order_items` (id, order_id, product_id, seller_id, title_snapshot, price_kopecks, quantity, commission_kopecks).
- Storage bucket `product-images` (публичный) для фото товаров.
- RLS: 
  - продукты — SELECT всем, INSERT/UPDATE/DELETE только владельцу-продавцу;
  - заказы — покупатель видит свои; продавец видит `order_items` где `seller_id = auth.uid()`;
  - user_roles — SELECT authenticated, INSERT только себе роль buyer/seller при регистрации.
- GRANT'ы для `authenticated`/`anon`/`service_role` согласно политикам.

## Маршруты (`src/routes/`)
- `/` — главная: hero, категории, популярные товары.
- `/catalog` — общий каталог: поиск, фильтр по категории, диапазон цены, сортировка.
- `/product/$id` — карточка товара + кнопка «В корзину».
- `/cart` — корзина (localStorage-based state через Zustand или контекст).
- `/checkout` — оформление (имя, телефон, адрес) → создаёт заказ, считает комиссию 10%.
- `/auth` — вход/регистрация с выбором роли.
- `/_authenticated/account` — общий кабинет: заказы покупателя.
- `/_authenticated/seller` — кабинет продавца:
  - `seller/products` — список + создание/редактирование (форма с загрузкой фото в Storage).
  - `seller/orders` — заказы, содержащие товары продавца, с суммой и комиссией.
- `/order-success/$id` — экран успешного заказа.

## Ключевая логика
- Цены в копейках (integer) для точности; вывод форматированный «1 299 ₽».
- Комиссия 10%: считается на бэке при создании заказа через `createServerFn` (`requireSupabaseAuth`) — сервер валидирует цены и остатки, списывает `stock`, пишет `commission_kopecks` в каждый `order_item` и суммарно в `order`.
- Корзина — клиентская (Zustand + persist в localStorage). При оформлении отправляется список `{product_id, quantity}` на сервер.
- Поиск — `ilike` по `title` + фильтры category/price через query params.
- Загрузка фото — client-side upload в bucket `product-images`, сохраняем public URL.

## Компоненты
- `Header` (desktop) + `BottomNav` (mobile).
- `ProductCard`, `ProductGrid`, `CategoryChips`, `PriceRangeFilter`, `SearchBar`.
- `CartDrawer`/страница, `CheckoutForm`, `OrderCard`, `SellerProductForm`.
- Все тексты — на русском.

## Что вне рамок
- Оплата (заказ создаётся со статусом `new`, без платежей).
- Модерация, отзывы, чаты, доставка-провайдеры.
- Админ-панель.

## Порядок реализации
1. Включить Lovable Cloud.
2. Миграции: enum, таблицы, RLS, GRANT'ы, `has_role`, bucket, сиды категорий.
3. Дизайн-токены в `src/styles.css` + базовый layout (header/bottom-nav) + русские мета-теги в `__root.tsx`.
4. Auth (`/auth`) с выбором роли + `_authenticated` уже управляется интеграцией.
5. Каталог + карточка товара + главная.
6. Корзина (Zustand) + checkout + server fn создания заказа с комиссией.
7. Кабинет покупателя (мои заказы).
8. Кабинет продавца: CRUD товаров с загрузкой фото + список заказов.
9. Полировка мобильной версии, пустые состояния, тосты.
