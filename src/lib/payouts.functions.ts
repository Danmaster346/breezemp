// Финансы продавца: запрос вывода средств и получение сохранённого способа.
// Валидация:
// - метод из белого списка (СБП / Карта / Счёт);
// - формат реквизитов по методу;
// - минимум 100 ₽;
// - сумма не больше доступного баланса (earned - withdrawn).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PayoutMethod = "sbp" | "card" | "bank";
const METHODS: readonly PayoutMethod[] = ["sbp", "card", "bank"] as const;
const MIN_AMOUNT_KOPECKS = 100_00; // 100 ₽

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

function validateDestination(method: PayoutMethod, dest: string): string {
  const d = dest.trim();
  if (method === "sbp") {
    const phone = digits(d);
    if (phone.length < 10 || phone.length > 15) {
      throw new Error("Введите номер телефона получателя");
    }
    return phone.length === 11 ? phone : phone;
  }
  if (method === "card") {
    const card = digits(d);
    if (card.length < 16 || card.length > 19) {
      throw new Error("Номер карты должен содержать 16–19 цифр");
    }
    return card;
  }
  // bank: expect "account:20 digits, bik:9 digits"
  const acc = digits(d.split(/[,;/|]/)[0] ?? "");
  const bik = digits(d.split(/[,;/|]/)[1] ?? "");
  if (acc.length !== 20 || bik.length !== 9) {
    throw new Error("Счёт (20 цифр) и БИК (9 цифр) заполнены неверно");
  }
  return `${acc}|${bik}`;
}

// Маскируем реквизиты перед сохранением, чтобы не хранить полные номера.
function maskDestination(method: PayoutMethod, normalized: string): string {
  if (method === "sbp") {
    const last = normalized.slice(-4);
    return `+•• ••• ••${last.slice(0, 1)} •${last.slice(1, 3)} ${last.slice(3)}`;
  }
  if (method === "card") {
    const last = normalized.slice(-4);
    return `•••• •••• •••• ${last}`;
  }
  const [acc, bik] = normalized.split("|");
  return `••• ${acc.slice(-4)} · БИК ${bik}`;
}

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      amount_kopecks: number;
      method: PayoutMethod;
      destination: string;
      note?: string;
      save_as_default?: boolean;
    }) => {
      if (
        !data ||
        typeof data.amount_kopecks !== "number" ||
        !Number.isFinite(data.amount_kopecks) ||
        !Number.isInteger(data.amount_kopecks) ||
        data.amount_kopecks < MIN_AMOUNT_KOPECKS
      ) {
        throw new Error("Минимальная сумма вывода — 100 ₽");
      }
      if (!METHODS.includes(data.method)) {
        throw new Error("Неизвестный способ вывода");
      }
      if (typeof data.destination !== "string" || data.destination.trim().length < 3) {
        throw new Error("Укажите реквизиты для вывода");
      }
      if (data.note && data.note.length > 300) {
        throw new Error("Комментарий слишком длинный");
      }
      return data;
    },
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const normalized = validateDestination(data.method, data.destination);
    const masked = maskDestination(data.method, normalized);

    // Считаем доступный баланс: только позиции, подтверждённые покупателем (received).
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .select("price_kopecks, quantity, commission_kopecks, status")
      .eq("seller_id", userId)
      .eq("status", "received");
    if (itemsErr) throw new Error(itemsErr.message);

    const totalPayout = (items ?? []).reduce(
      (s, r) => s + (r.price_kopecks * r.quantity - r.commission_kopecks),
      0,
    );

    const { data: payouts, error: payErr } = await supabaseAdmin
      .from("payouts")
      .select("amount_kopecks")
      .eq("seller_id", userId)
      .neq("status", "rejected");
    if (payErr) throw new Error(payErr.message);

    const withdrawn = (payouts ?? []).reduce((s, p) => s + p.amount_kopecks, 0);
    const available = Math.max(0, totalPayout - withdrawn);

    if (data.amount_kopecks > available) {
      throw new Error("Сумма больше доступного баланса");
    }

    const { error } = await supabaseAdmin
      .from("payouts")
      .insert({
        seller_id: userId,
        amount_kopecks: data.amount_kopecks,
        method: data.method,
        destination: masked,
        note: data.note?.trim() || null,
      });
    if (error) throw new Error(error.message);

    if (data.save_as_default) {
      await supabaseAdmin
        .from("seller_profiles")
        .update({
          default_payout_method: data.method,
          default_payout_destination: masked,
        })
        .eq("user_id", userId);
    }

    return { ok: true, amount_kopecks: data.amount_kopecks, method: data.method, destination: masked };
  });

export const getPayoutDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("seller_profiles")
      .select("default_payout_method, default_payout_destination")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      method: (data?.default_payout_method as PayoutMethod | null) ?? null,
      destination: data?.default_payout_destination ?? null,
    };
  });
