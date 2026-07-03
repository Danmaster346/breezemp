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
    const { supabase, userId } = context;

    // Compute earned = sum(price * qty - commission) for this seller
    const { data: items, error: itemsErr } = await supabase
      .from("order_items")
      .select("price_kopecks, quantity, commission_kopecks")
      .eq("seller_id", userId);
    if (itemsErr) throw new Error(itemsErr.message);

    const totalPayout = (items ?? []).reduce(
      (s, r) => s + (r.price_kopecks * r.quantity - r.commission_kopecks),
      0,
    );

    const { data: payouts, error: payErr } = await supabase
      .from("payouts")
      .select("amount_kopecks")
      .eq("seller_id", userId);
    if (payErr) throw new Error(payErr.message);

    const withdrawn = (payouts ?? []).reduce((s, p) => s + p.amount_kopecks, 0);
    const available = Math.max(0, totalPayout - withdrawn);

    if (data.amount_kopecks > available) {
      throw new Error("Requested amount exceeds available balance");
    }

    // Insert via service role (RLS blocks direct client inserts)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("payouts")
      .insert({ seller_id: userId, amount_kopecks: data.amount_kopecks });
    if (error) throw new Error(error.message);

    return { ok: true, amount_kopecks: data.amount_kopecks };
  });
