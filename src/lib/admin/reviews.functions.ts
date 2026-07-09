import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAdminReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string; hidden?: "all" | "visible" | "hidden"; page?: number; pageSize?: number }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const page = data.page ?? 1;
    const size = Math.min(data.pageSize ?? 30, 100);
    const from = (page - 1) * size;
    let q = supabaseAdmin
      .from("reviews")
      .select("*, products(title)", { count: "exact" });
    if (data.q) q = q.ilike("comment", `%${data.q.trim()}%`);
    if (data.hidden === "visible") q = q.eq("is_hidden", false);
    if (data.hidden === "hidden") q = q.eq("is_hidden", true);
    const { data: rows, error, count } = await q.order("created_at", { ascending: false }).range(from, from + size - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page, pageSize: size };
  });

export const setReviewHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; hidden: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("reviews").update({ is_hidden: data.hidden }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(context.userId, data.hidden ? "review.hide" : "review.show", "review", data.id, {});
    return { ok: true };
  });

export const deleteReviewAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(context.userId, "review.delete", "review", data.id, {});
    return { ok: true };
  });
