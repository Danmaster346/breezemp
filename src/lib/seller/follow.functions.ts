// Подписка покупателя на магазин продавца (favorites_sellers).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sellerInput = (d: unknown) => z.object({ seller_id: z.string().uuid() }).parse(d);

export const isFollowingSeller = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sellerInput)
  .handler(async ({ data, context }): Promise<{ following: boolean }> => {
    const { data: row } = await context.supabase
      .from("favorites_sellers")
      .select("id")
      .eq("user_id", context.userId)
      .eq("seller_id", data.seller_id)
      .maybeSingle();
    return { following: !!row };
  });

export const toggleFollowSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sellerInput)
  .handler(async ({ data, context }): Promise<{ following: boolean }> => {
    if (data.seller_id === context.userId) throw new Error("Нельзя подписаться на себя");
    const { data: row } = await context.supabase
      .from("favorites_sellers")
      .select("id")
      .eq("user_id", context.userId)
      .eq("seller_id", data.seller_id)
      .maybeSingle();
    if (row) {
      const { error } = await context.supabase.from("favorites_sellers").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
      return { following: false };
    }
    const { error } = await context.supabase
      .from("favorites_sellers")
      .insert({ user_id: context.userId, seller_id: data.seller_id });
    if (error) throw new Error(error.message);
    return { following: true };
  });
