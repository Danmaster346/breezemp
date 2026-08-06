// Публичное отслеживание заказа по короткому номеру.
// Возвращает только безопасный DTO: без телефонов, e-mail и id пользователей.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeStatus, type OrderStatus } from "@/lib/order-status";
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

const STAGE_LABELS: Record<TrackStage, string> = {
  accepted: "Принят",
  packing: "Собирается",
  shipped: "Отправлен",
  in_transit: "В пути",
  delivered: "Доставлен",
};

const STAGE_ORDER: TrackStage[] = ["accepted", "packing", "shipped", "in_transit", "delivered"];

/** Маскирует адрес: оставляем город и улицу, номер дома/квартиру скрываем. */
function maskAddress(address: string | null): string {
  if (!address) return "Адрес не указан";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.map((p, i) => (i === parts.length - 1 && parts.length > 1 ? "•••" : p)).join(", ");
  return [...parts.slice(0, 2), "•••"].join(", ");
}

/** Ожидаемая дата доставки: от даты отправки (или оформления) + срок способа доставки. */
function calcEta(method: string, createdAt: string, shippedAt: string | null) {
  const opt = getShippingOption(method);
  const days = Number(opt.eta.replace(/[^\d–-]/g, "").split(/[–-]/).pop() ?? 3) || 3;
  const base = new Date(shippedAt ?? createdAt);
  base.setDate(base.getDate() + days);
  return { eta_date: base.toISOString(), eta_label: opt.eta };
}

export const getOrderTracking = createServerFn({ method: "GET" })
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().trim().min(4).max(40) }).parse(input),
  )
  .handler(async ({ data }): Promise<TrackingResult> => {
    const clean = data.code.replace(/[^0-9a-fA-F-]/g, "");
    if (clean.replace(/-/g, "").length < 4) return { found: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orderId, error: rpcError } = await supabaseAdmin.rpc("find_order_id_by_code", {
      _code: clean,
    });
    if (rpcError || !orderId) return { found: false };

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        "id, created_at, total_kopecks, shipping_cost_kopecks, shipping_method, shipping_address, order_items(title_snapshot, image_url, price_kopecks, quantity, status, tracking_number, shipping_carrier, shipped_at, received_at, returned_at)",
      )
      .eq("id", orderId as string)
      .maybeSingle();

    if (error || !order) return { found: false };

    const items = (order.order_items ?? []) as Array<{
      title_snapshot: string;
      image_url: string | null;
      price_kopecks: number;
      quantity: number;
      status: string | null;
      tracking_number: string | null;
      shipping_carrier: string | null;
      shipped_at: string | null;
      received_at: string | null;
      returned_at: string | null;
    }>;

    // Агрегированный статус заказа: берём «самый ранний» этап среди позиций
    const rank: Record<OrderStatus, number> = {
      new: 0,
      confirmed: 0,
      processing: 0,
      shipped: 1,
      delivered: 2,
      received: 3,
      returned: 4,
      cancelled: 5,
    };
    const statuses = items.map((it) => normalizeStatus(it.status));
    const active = statuses.filter((s) => s !== "cancelled" && s !== "returned");
    const status: OrderStatus =
      active.length > 0
        ? active.reduce((a, b) => (rank[a] <= rank[b] ? a : b))
        : (statuses[0] ?? "processing");

    // История статусов из БД (если триггер уже успел записать события)
    const { data: rawHistory } = await supabaseAdmin
      .from("order_status_history")
      .select("new_status, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    const history: TrackEvent[] = [];
    const seen = new Set<string>();
    for (const h of rawHistory ?? []) {
      const st = normalizeStatus(h.new_status);
      const label = st === "processing" ? "Заказ принят и собирается" : STATUS_TEXT[st];
      if (seen.has(label)) continue;
      seen.add(label);
      history.push({ label, date: h.created_at });
    }

    const shippedAt = items.map((i) => i.shipped_at).filter(Boolean).sort()[0] ?? null;
    const receivedAt = items.map((i) => i.received_at).filter(Boolean).sort().pop() ?? null;

    const stageDates: Record<TrackStage, string | null> = {
      accepted: order.created_at,
      packing: order.created_at,
      shipped: shippedAt,
      in_transit: shippedAt,
      delivered: receivedAt ?? (status === "delivered" || status === "received" ? shippedAt : null),
    };

    const reachedIndex =
      status === "received" || status === "delivered"
        ? 4
        : status === "shipped"
          ? 3
          : status === "cancelled" || status === "returned"
            ? 1
            : 1;

    const steps: TrackStep[] = STAGE_ORDER.map((key, i) => ({
      key,
      label: STAGE_LABELS[key],
      date: stageDates[key],
      state: i < reachedIndex ? "done" : i === reachedIndex ? "current" : "upcoming",
    }));

    const opt = getShippingOption(order.shipping_method ?? "pickup");
    const { eta_date, eta_label } = calcEta(order.shipping_method ?? "pickup", order.created_at, shippedAt);

    return {
      found: true,
      code: order.id.replace(/-/g, "").slice(0, 8).toUpperCase(),
      created_at: order.created_at,
      status,
      steps,
      history,
      items: items.map((it) => ({
        title: it.title_snapshot,
        image_url: it.image_url,
        price_kopecks: it.price_kopecks,
        quantity: it.quantity,
        status: normalizeStatus(it.status),
        tracking_number: it.tracking_number,
        shipping_carrier: it.shipping_carrier,
      })),
      total_kopecks: order.total_kopecks,
      shipping_cost_kopecks: order.shipping_cost_kopecks ?? 0,
      shipping_method_label: opt.label,
      shipping_address_masked: maskAddress(order.shipping_address),
      eta_label,
      eta_date: status === "received" ? null : eta_date,
    };
  });

const STATUS_TEXT: Record<OrderStatus, string> = {
  new: "Заказ принят",
  confirmed: "Заказ принят",
  processing: "Заказ собирается",
  shipped: "Заказ отправлен",
  delivered: "Заказ доставлен",
  received: "Заказ получен",
  returned: "Оформлен возврат",
  cancelled: "Заказ отменён",
};
