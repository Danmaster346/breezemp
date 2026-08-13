// Выплаты продавцам: список с балансами, ручная выплата и заморозка баланса.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminPayoutRow = {
  seller_id: string;
  shop_name: string;
  earned_kopecks: number;
  available_kopecks: number;
  paid_kopecks: number;
  frozen: boolean;
  freeze_reason: string | null;
  last_payout_at: string | null;
};

export const listAdminPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { filter?: "all" | "pending" | "frozen"; q?: string; page?: number; pageSize?: number }) => d ?? {})
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);

    const page = data.page ?? 1;
    const size = Math.min(data.pageSize ?? 30, 100);

    // Все проданные и полученные позиции (заработано = 90% от цены * количество).
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .select("seller_id, price_kopecks, quantity, status")
      .eq("status", "received");
    if (itemsErr) throw new Error(itemsErr.message);

    const earnedMap = new Map<string, number>();
    (items ?? []).forEach((it) => {
      const line = Math.round(it.price_kopecks * it.quantity * 0.9);
      earnedMap.set(it.seller_id, (earnedMap.get(it.seller_id) ?? 0) + line);
    });

    const { data: payouts, error: payErr } = await supabaseAdmin
      .from("payouts")
      .select("seller_id, amount_kopecks, status, created_at")
      .neq("status", "rejected");
    if (payErr) throw new Error(payErr.message);

    const paidMap = new Map<string, number>();
    const lastPayoutMap = new Map<string, string>();
    (payouts ?? []).forEach((p) => {
      paidMap.set(p.seller_id, (paidMap.get(p.seller_id) ?? 0) + p.amount_kopecks);
      const prev = lastPayoutMap.get(p.seller_id);
      if (!prev || new Date(p.created_at) > new Date(prev)) lastPayoutMap.set(p.seller_id, p.created_at);
    });

    const sellerIds = Array.from(new Set([...earnedMap.keys(), ...paidMap.keys()]));
    if (sellerIds.length === 0) {
      return { rows: [] as AdminPayoutRow[], total: 0, page, pageSize: size };
    }

    const { data: sellerProfiles } = await supabaseAdmin
      .from("seller_profiles")
      .select("user_id, shop_name, balance_frozen, freeze_reason")
      .in("user_id", sellerIds);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", sellerIds);

    const spMap = new Map((sellerProfiles ?? []).map((s) => [s.user_id, s]));
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    let rows: AdminPayoutRow[] = sellerIds.map((sid) => {
      const sp = spMap.get(sid);
      const p = pMap.get(sid);
      const earned = earnedMap.get(sid) ?? 0;
      const paid = paidMap.get(sid) ?? 0;
      return {
        seller_id: sid,
        shop_name: sp?.shop_name || p?.full_name || p?.email || sid.slice(0, 8),
        earned_kopecks: earned,
        available_kopecks: Math.max(0, earned - paid),
        paid_kopecks: paid,
        frozen: !!sp?.balance_frozen,
        freeze_reason: sp?.freeze_reason ?? null,
        last_payout_at: lastPayoutMap.get(sid) ?? null,
      };
    });

    if (data.q && data.q.trim()) {
      const q = data.q.trim().toLowerCase();
      rows = rows.filter((r) => {
        const p = pMap.get(r.seller_id);
        return (
          r.shop_name.toLowerCase().includes(q) ||
          (p?.full_name ?? "").toLowerCase().includes(q) ||
          (p?.email ?? "").toLowerCase().includes(q)
        );
      });
    }

    if (data.filter === "pending") {
      rows = rows.filter((r) => r.available_kopecks > 0 && !r.frozen);
    } else if (data.filter === "frozen") {
      rows = rows.filter((r) => r.frozen);
    }

    rows.sort((a, b) => b.available_kopecks - a.available_kopecks);

    const total = rows.length;
    const from = (page - 1) * size;
    rows = rows.slice(from, from + size);

    return { rows, total, page, pageSize: size };
  });

export const processAdminPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { seller_id: string; amount_kopecks: number; note?: string }) => {
    if (!d || typeof d.seller_id !== "string" || !d.seller_id) throw new Error("Не указан продавец");
    if (typeof d.amount_kopecks !== "number" || !Number.isFinite(d.amount_kopecks) || !Number.isInteger(d.amount_kopecks) || d.amount_kopecks <= 0) {
      throw new Error("Некорректная сумма выплаты");
    }
    return d;
  })
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);

    const { data: sp } = await supabaseAdmin
      .from("seller_profiles")
      .select("balance_frozen")
      .eq("user_id", data.seller_id)
      .maybeSingle();
    if (sp?.balance_frozen) throw new Error("Баланс продавца заморожен");

    const { data: items, error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .select("price_kopecks, quantity, status")
      .eq("seller_id", data.seller_id)
      .eq("status", "received");
    if (itemsErr) throw new Error(itemsErr.message);
    const earned = (items ?? []).reduce((s, r) => s + Math.round(r.price_kopecks * r.quantity * 0.9), 0);

    const { data: payouts, error: payErr } = await supabaseAdmin
      .from("payouts")
      .select("amount_kopecks")
      .eq("seller_id", data.seller_id)
      .neq("status", "rejected");
    if (payErr) throw new Error(payErr.message);
    const paid = (payouts ?? []).reduce((s, p) => s + p.amount_kopecks, 0);
    const available = Math.max(0, earned - paid);

    if (data.amount_kopecks > available) {
      throw new Error("Сумма больше доступного баланса продавца");
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("payouts")
      .insert({
        seller_id: data.seller_id,
        amount_kopecks: data.amount_kopecks,
        status: "paid",
        note: data.note?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAction(context.userId, "payout.process", "payout", inserted.id, {
      seller_id: data.seller_id,
      amount_kopecks: data.amount_kopecks,
      note: data.note,
    });

    return { ok: true, id: inserted.id };
  });

export const freezeSellerBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { seller_id: string; frozen: boolean; reason?: string }) => {
    if (!d || typeof d.seller_id !== "string" || !d.seller_id) throw new Error("Не указан продавец");
    return d;
  })
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);

    const { error } = await supabaseAdmin
      .from("seller_profiles")
      .upsert(
        {
          user_id: data.seller_id,
          balance_frozen: data.frozen,
          freeze_reason: data.frozen ? (data.reason?.trim() || null) : null,
          frozen_at: data.frozen ? new Date().toISOString() : null,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    await logAction(context.userId, data.frozen ? "payout.freeze" : "payout.unfreeze", "seller", data.seller_id, {
      reason: data.reason,
    });

    return { ok: true };
  });
