// Метки, цвета и пайплайн статусов позиции заказа
export type OrderStatus =
  | "new"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "received"
  | "returned"
  | "cancelled";

// Русские названия статусов (единые для продавца и покупателя)
export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  processing: "На сборке",
  shipped: "Отправлен",
  delivered: "Доставлен",
  received: "Получено",
  returned: "Возврат",
  cancelled: "Отмена",
};

// Классы для цветной «плашки» статуса
export const STATUS_BADGE: Record<OrderStatus, string> = {
  new: "bg-muted text-foreground",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-amber-100 text-amber-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-emerald-100 text-emerald-800",
  received: "bg-emerald-200 text-emerald-900",
  returned: "bg-orange-100 text-orange-800",
  cancelled: "bg-rose-100 text-rose-800",
};

// Основной последовательный пайплайн (кнопка «Следующий этап»)
export const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  new: "processing",
  confirmed: "processing",
  processing: "shipped",
  shipped: "delivered",
  delivered: "received",
  received: null,
  returned: null,
  cancelled: null,
};

// Все статусы (порядок пайплайна) — для UI списка
export const ALL_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "received",
  "returned",
  "cancelled",
];

// Статусы, при переходе в которые показываем яркий toast.success
export const NOTIFY_STATUSES: OrderStatus[] = [
  "shipped",
  "delivered",
  "received",
  "returned",
  "cancelled",
];
