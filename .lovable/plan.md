# Админ-панель BREEZE

Полноценная админка для управления маркетплейсом с доступом только для роли `admin`.

## 1. База данных (миграция)

Новые таблицы и колонки:
- `products.moderation_status` — enum: `pending`, `approved`, `rejected`, `blocked`; `moderation_reason`, `moderated_at`, `moderated_by`
- `profiles.is_blocked` (bool), `profiles.blocked_reason`, `profiles.email`, `profiles.phone` (для поиска)
- `order_items` — добавить поле `return_admin_status` (`none`, `approved`, `rejected`)
- Таблица `admin_logs` — id, admin_id, action (text), entity_type, entity_id, details (jsonb), created_at
- Таблица `categories` — уже есть, добавим `sort_order`, `icon_url`
- `promo_codes` — уже есть, добавим `usage_count`
- RLS: полный доступ для роли `admin` через `has_role(auth.uid(),'admin')`; select политики для админа на все таблицы

## 2. Server functions (`src/lib/admin/*.functions.ts`)

Все с middleware `requireSupabaseAuth` + внутренняя проверка `has_role(admin)`:
- `admin-dashboard.functions.ts` — статистика (пользователи, заказы, комиссии, возвраты) с разбивкой по периодам; графики (динамика заказов, топ категорий/продавцов)
- `admin-users.functions.ts` — list с пагинацией/фильтрами/поиском, updateRole, toggleBlock, getUserOrders, getUserProducts
- `admin-products.functions.ts` — list, approve/reject (с reason), block/unblock, update, delete, bulk actions
- `admin-orders.functions.ts` — list, get by id, forceUpdateStatus
- `admin-returns.functions.ts` — list, approve/reject, requestMoreInfo (отправляет системное сообщение в чат)
- `admin-reviews.functions.ts` — list, delete, hide/show
- `admin-categories.functions.ts` — CRUD + reorder
- `admin-promo.functions.ts` — CRUD + активация, usage stats
- `admin-logs.functions.ts` — list с фильтрами

Каждое опасное действие логируется в `admin_logs`.

## 3. Роутинг (`src/routes/_authenticated/admin/`)

Pathless layout с проверкой роли — редирект на `/` если не админ.
- `admin/route.tsx` — layout с sidebar (Dashboard, Users, Products, Orders, Returns, Reviews, Categories, Promo, Logs)
- `admin/index.tsx` — Dashboard (карточки статистики, графики recharts)
- `admin/users.tsx` — таблица + фильтры + модалка деталей
- `admin/products.tsx` — таблица + bulk actions + модерация
- `admin/orders.tsx` — таблица + деталь
- `admin/returns.tsx` — список возвратов
- `admin/reviews.tsx` — модерация
- `admin/categories.tsx` — CRUD с drag order
- `admin/promo.tsx` — CRUD
- `admin/logs.tsx` — audit log

## 4. UI компоненты

- `src/components/admin/AdminLayout.tsx` — sidebar + top bar с уведомлениями
- `src/components/admin/DataTable.tsx` — переиспользуемая таблица с сортировкой, пагинацией, bulk select
- `src/components/admin/StatCard.tsx`, `Chart.tsx` (recharts уже стоит)
- `src/components/admin/ConfirmDialog.tsx` — модалка подтверждения

Мобильно: таблицы превращаются в карточки через media query.

## 5. Интеграция

- Ссылка «Админ-панель» в `AppLayout` header/меню — видна только админам (через `roles.functions.ts`)
- Toast-уведомления через `sonner`
- Пагинация server-side, поиск с debounce

## Технические детали

- Библиотеки уже есть: `recharts`, `sonner`, shadcn/ui, `@tanstack/react-query`
- Все server functions возвращают DTO, проверка прав через `has_role` RPC
- Bulk actions — server function принимает массив id
- Audit log пишется триггером `admin_log_action(action, entity_type, entity_id, details)` внутри каждой мутации

## Порядок реализации

1. Миграция БД (таблицы, колонки, RLS, admin_logs)
2. Server functions (все модули)
3. Admin layout + защита роута
4. Dashboard
5. Users, Products, Orders (основные)
6. Returns, Reviews, Categories, Promo, Logs
7. Интеграция в шапку + мобильная адаптация
