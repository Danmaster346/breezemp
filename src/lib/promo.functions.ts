// Валидация промокодов на сервере
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export interface PromoValidationResult {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  discount_kopecks: number; // применённая скидка в копейках
  min_order_kopecks: number;
}

function serverClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

// Вычисляем размер скидки в копейках по промокоду и сумме заказа
export function computeDiscountKopecks(
  promo: { discount_type: string; discount_value: number },
  subtotalKopecks: number,
): number {
  if (promo.discount_type === "percent") {
    return Math.min(subtotalKopecks, Math.round((subtotalKopecks * promo.discount_value) / 100));
  }
  return Math.min(subtotalKopecks, promo.discount_value);
}

const validateSchema = z.object({
  code: z.string().trim().min(1).max(64),
  subtotal_kopecks: z.number().int().nonnegative(),
});

export const validatePromoCode = createServerFn({ method: "POST" })
  .inputValidator((d) => validateSchema.parse(d))
  .handler(async ({ data }): Promise<PromoValidationResult> => {
    const supabase = serverClient();
    const code = data.code.trim().toUpperCase();
    const { data: promo, error } = await supabase
      .from("promo_codes")
      .select("code, discount_type, discount_value, active, expires_at, max_uses, used_count, min_order_kopecks")
      .eq("code", code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!promo || !promo.active) throw new Error("Промокод не найден или неактивен");
    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
      throw new Error("Срок действия промокода истёк");
    }
    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
      throw new Error("Промокод больше не действует");
    }
    if (data.subtotal_kopecks < promo.min_order_kopecks) {
      throw new Error(
        `Промокод действует от суммы ${(promo.min_order_kopecks / 100).toFixed(0)} ₽`,
      );
    }
    const discount = computeDiscountKopecks(promo, data.subtotal_kopecks);
    return {
      code: promo.code,
      discount_type: promo.discount_type as "percent" | "fixed",
      discount_value: promo.discount_value,
      discount_kopecks: discount,
      min_order_kopecks: promo.min_order_kopecks,
    };
  });
