// Server function for seller payouts. Validates that the requested amount
// does not exceed actually earned (sales - 10% commission - already withdrawn).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { amount_kopecks: number }) => {
    if (
      !data ||
      typeof data.amount_kopecks !== "number" ||
      !Number.isFinite(data.amount_kopecks) ||
      !Number.isInteger(data.amount_kopecks) ||
      data.amount_kopecks <= 0
    ) {
      throw new Error("Invalid amount");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // К выводу доступны только позиции, по которым покупатель подтвердил получение.
    // Доставленные, но не подтверждённые товары остаются «в ожидании».
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
      throw new Error("Requested amount exceeds available balance");
    }

    const { error } = await supabaseAdmin
      .from("payouts")
      .insert({ seller_id: userId, amount_kopecks: data.amount_kopecks });
    if (error) throw new Error(error.message);

    return { ok: true, amount_kopecks: data.amount_kopecks };
  });
