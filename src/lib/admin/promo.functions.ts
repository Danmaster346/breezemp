import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAdminPromos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("promo_codes").select("*").order("code");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertPromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; code: string; discount_type: "percent" | "amount"; discount_value: number; active: boolean; max_uses?: number | null; expires_at?: string | null }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const payload = {
      code: data.code.trim().toUpperCase(),
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      active: data.active,
      max_uses: data.max_uses ?? null,
      expires_at: data.expires_at ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("promo_codes").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAction(context.userId, "promo.update", "promo", data.id, payload);
    } else {
      const { data: created, error } = await supabaseAdmin.from("promo_codes").insert(payload).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      await logAction(context.userId, "promo.create", "promo", created?.id ?? null, payload);
    }
    return { ok: true };
  });

export const deletePromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("promo_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(context.userId, "promo.delete", "promo", data.id, {});
    return { ok: true };
  });
