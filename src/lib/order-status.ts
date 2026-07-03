// Метки и цвета статусов заказа для UI
export type OrderStatus =
  | "new"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

// Русские названия статусов
export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  processing: "На сборке",
  shipped: "Доставляется",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

// Следующий статус в пайплайне (для последовательного перевода)
export const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  new: "confirmed",
  confirmed: "processing",
  processing: "shipped",
  shipped: "delivered",
  delivered: null,
  cancelled: null,
};

// Классы для цветной «плашки» статуса
export const STATUS_BADGE: Record<OrderStatus, string> = {
  new: "bg-muted text-foreground",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-amber-100 text-amber-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
};

// Все статусы в порядке пайплайна
export const ALL_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];
