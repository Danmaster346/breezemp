// Публичное отслеживание заказа по короткому номеру.
// Возвращает только безопасный DTO: без телефонов, e-mail и id пользователей.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeStatus, type OrderStatus } from "@/lib/order-status";
import { getShippingOption } from "@/lib/shipping";
import {
  STAGE_LABELS,
  STAGE_ORDER,
  STATUS_RANK,
  STATUS_TEXT,
  calcEta,
  maskAddress,
  normalizeCode,
  stageIndexForStatus,
  type TrackEvent,
  type TrackStage,
  type TrackStep,
  type TrackingResult,
} from "@/lib/tracking.shared";

export const getOrderTracking = createServerFn({ method: "GET" })
  .inputValidator((input: { code: string }) =>
    z.object({ code: z.string().trim().min(4).max(40) }).parse(input),
  )
  .handler(async ({ data }): Promise<TrackingResult> => {
    const clean = normalizeCode(data.code);
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

    // Агрегированный статус заказа: берём «самый ранний» этап среди активных позиций
    const statuses = items.map((it) => normalizeStatus(it.status));
    const active = statuses.filter((s) => s !== "cancelled" && s !== "returned");
    const status: OrderStatus =
      active.length > 0
        ? active.reduce((a, b) => (STATUS_RANK[a] <= STATUS_RANK[b] ? a : b))
        : (statuses[0] ?? "processing");

    // История статусов из БД (если триггер уже записал события)
    const { data: rawHistory } = await supabaseAdmin
      .from("order_status_history")
      .select("new_status, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    const history: TrackEvent[] = [];
    const seen = new Set<string>();
    for (const h of rawHistory ?? []) {
      const label = STATUS_TEXT[normalizeStatus(h.new_status)];
      if (seen.has(label)) continue;
      seen.add(label);
      history.push({ label, date: h.created_at });
    }

    const shippedAt =
      items.map((i) => i.shipped_at).filter((v): v is string => !!v).sort()[0] ?? null;
    const receivedAt =
      items.map((i) => i.received_at).filter((v): v is string => !!v).sort().pop() ?? null;

    const stageDates: Record<TrackStage, string | null> = {
      accepted: order.created_at,
      packing: order.created_at,
      shipped: shippedAt,
      in_transit: shippedAt,
      delivered: receivedAt ?? (status === "delivered" || status === "received" ? shippedAt : null),
    };

    const reachedIndex = stageIndexForStatus(status);
    const steps: TrackStep[] = STAGE_ORDER.map((key, i) => ({
      key,
      label: STAGE_LABELS[key],
      date: stageDates[key],
      state: i < reachedIndex ? "done" : i === reachedIndex ? "current" : "upcoming",
    }));

    const opt = getShippingOption(order.shipping_method ?? "pickup");
    const eta = calcEta(order.shipping_method ?? "pickup", order.created_at, shippedAt);

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
      eta_label: eta.eta_label,
      eta_date: status === "received" || status === "cancelled" ? null : eta.eta_date,
    };
  });
