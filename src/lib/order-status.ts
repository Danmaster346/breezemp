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

// Русские названия статусов
export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "На сборке",
  confirmed: "На сборке",
  processing: "На сборке",
  shipped: "Отправлен",
  delivered: "Отправлен",
  received: "Получено",
  returned: "Возврат",
  cancelled: "Отменён",
};

// Классы для цветной «плашки» статуса (в стиле WB)
export const STATUS_BADGE: Record<OrderStatus, string> = {
  new: "bg-amber-100 text-amber-800",
  confirmed: "bg-amber-100 text-amber-800",
  processing: "bg-amber-100 text-amber-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-indigo-100 text-indigo-800",
  received: "bg-emerald-100 text-emerald-800",
  returned: "bg-orange-100 text-orange-800",
  cancelled: "bg-rose-100 text-rose-800",
};

// Статусы, попадающие в фильтр списка (сгруппированные)
export const ALL_STATUSES: OrderStatus[] = [
  "processing",
  "shipped",
  "received",
  "returned",
  "cancelled",
];

// Службы доставки (список для выпадающего меню)
export const CARRIERS = [
  "СДЭК",
  "Яндекс Доставка",
  "Boxberry",
  "Почта России",
  "Ozon Rocket",
  "5Post",
  "DPD",
  "Курьер продавца",
] as const;

// Причины возврата
export const RETURN_REASONS = [
  "Не подошёл размер",
  "Товар с браком",
  "Не соответствует описанию",
  "Пришло не то, что заказывал",
  "Передумал",
  "Другое",
] as const;

// Нормализация в «стадию» для фильтров: старые processing/new/confirmed → processing
export function normalizeStatus(s: string | null | undefined): OrderStatus {
  const st = (s ?? "processing") as OrderStatus;
  if (st === "new" || st === "confirmed") return "processing";
  if (st === "delivered") return "shipped";
  return st;
}
