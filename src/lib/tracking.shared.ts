// Общие типы и хелперы отслеживания заказа (безопасны для клиента).
import type { OrderStatus } from "@/lib/order-status";
import { getShippingOption } from "@/lib/shipping";

export type TrackStage = "accepted" | "packing" | "shipped" | "in_transit" | "delivered";

export type TrackStep = {
  key: TrackStage;
  label: string;
  date: string | null;
  state: "done" | "current" | "upcoming";
};

export type TrackItem = {
  title: string;
  image_url: string | null;
  price_kopecks: number;
  quantity: number;
  status: OrderStatus;
  tracking_number: string | null;
  shipping_carrier: string | null;
};

export type TrackEvent = { label: string; date: string };

export type TrackingResult =
  | { found: false }
  | {
      found: true;
      code: string;
      created_at: string;
      status: OrderStatus;
      steps: TrackStep[];
      history: TrackEvent[];
      items: TrackItem[];
      total_kopecks: number;
      shipping_cost_kopecks: number;
      shipping_method_label: string;
      shipping_address_masked: string;
      eta_label: string;
      eta_date: string | null;
    };

export const STAGE_LABELS: Record<TrackStage, string> = {
  accepted: "Принят",
  packing: "Собирается",
  shipped: "Отправлен",
  in_transit: "В пути",
  delivered: "Доставлен",
};

export const STAGE_ORDER: TrackStage[] = [
  "accepted",
  "packing",
  "shipped",
  "in_transit",
  "delivered",
];

export const STATUS_TEXT: Record<OrderStatus, string> = {
  new: "Заказ принят",
  confirmed: "Заказ принят",
  processing: "Заказ собирается",
  shipped: "Заказ отправлен",
  delivered: "Заказ доставлен",
  received: "Заказ получен",
  returned: "Оформлен возврат",
  cancelled: "Заказ отменён",
};

/** Порядковый «вес» статуса для агрегации по позициям заказа. */
export const STATUS_RANK: Record<OrderStatus, number> = {
  new: 0,
  confirmed: 0,
  processing: 0,
  shipped: 1,
  delivered: 2,
  received: 3,
  returned: 4,
  cancelled: 5,
};

/** Нормализует введённый пользователем номер заказа. */
export function normalizeCode(raw: string): string {
  return raw.replace(/[^0-9a-fA-F-]/g, "");
}

/** Маскирует адрес: оставляем город и улицу, номер дома/квартиру скрываем. */
export function maskAddress(address: string | null): string {
  if (!address) return "Адрес не указан";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) {
    return parts.map((p, i) => (parts.length > 1 && i === parts.length - 1 ? "•••" : p)).join(", ");
  }
  return [...parts.slice(0, 2), "•••"].join(", ");
}

/** Ожидаемая дата доставки: от даты отправки (или оформления) + срок способа доставки. */
export function calcEta(method: string, createdAt: string, shippedAt: string | null) {
  const opt = getShippingOption(method);
  const parsed = Number(opt.eta.replace(/[^\d–-]/g, "").split(/[–-]/).pop());
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
  const base = new Date(shippedAt ?? createdAt);
  base.setDate(base.getDate() + days);
  return { eta_date: base.toISOString(), eta_label: opt.eta };
}

/** Индекс текущего этапа степпера по агрегированному статусу. */
export function stageIndexForStatus(status: OrderStatus): number {
  if (status === "received" || status === "delivered") return 4;
  if (status === "shipped") return 3;
  return 1;
}
