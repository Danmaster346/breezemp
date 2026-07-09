import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAdminProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string; status?: string; categoryId?: string; sellerId?: string; page?: number; pageSize?: number }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const page = data.page ?? 1;
    const size = Math.min(data.pageSize ?? 30, 100);
    const from = (page - 1) * size;

    let q = supabaseAdmin
      .from("products")
      .select("id, title, price_kopecks, stock, is_active, moderation_status, moderation_reason, image_url, seller_id, category_id, created_at, categories(name)", { count: "exact" });
    if (data.q) q = q.ilike("title", `%${data.q.trim()}%`);
    if (data.status && data.status !== "all") q = q.eq("moderation_status", data.status);
    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    if (data.sellerId) q = q.eq("seller_id", data.sellerId);

    const { data: rows, error, count } = await q.order("created_at", { ascending: false }).range(from, from + size - 1);
    if (error) throw new Error(error.message);
    // Fetch seller names separately (нет FK-связи в постгресте)
    const sellerIds = [...new Set((rows ?? []).map((r) => r.seller_id))];
    const { data: sellers } = sellerIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", sellerIds)
      : { data: [] };
    const nameMap = new Map((sellers ?? []).map((s) => [s.id, s.full_name]));
    const withSeller = (rows ?? []).map((r) => ({ ...r, profiles: { full_name: nameMap.get(r.seller_id) ?? null } }));
    return { rows: withSeller, total: count ?? 0, page, pageSize: size };
  });

export const moderateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { productId: string; action: "approve" | "reject" | "block" | "unblock"; reason?: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const map: Record<string, { moderation_status: string; is_active?: boolean }> = {
      approve: { moderation_status: "approved", is_active: true },
      reject: { moderation_status: "rejected", is_active: false },
      block: { moderation_status: "blocked", is_active: false },
      unblock: { moderation_status: "approved", is_active: true },
    };
    const patch = { ...map[data.action], moderation_reason: data.reason ?? null, moderated_at: new Date().toISOString(), moderated_by: context.userId };
    const { error } = await supabaseAdmin.from("products").update(patch).eq("id", data.productId);
    if (error) throw new Error(error.message);
    await logAction(context.userId, `product.${data.action}`, "product", data.productId, { reason: data.reason });
    return { ok: true };
  });

export const bulkModerateProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[]; action: "approve" | "reject" | "block" | "unblock" | "delete"; reason?: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    if (data.ids.length === 0) return { ok: true };
    if (data.action === "delete") {
      const { error } = await supabaseAdmin.from("products").delete().in("id", data.ids);
      if (error) throw new Error(error.message);
    } else {
      const map: Record<string, { moderation_status: string; is_active: boolean }> = {
        approve: { moderation_status: "approved", is_active: true },
        reject: { moderation_status: "rejected", is_active: false },
        block: { moderation_status: "blocked", is_active: false },
        unblock: { moderation_status: "approved", is_active: true },
      };
      const patch = { ...map[data.action], moderation_reason: data.reason ?? null, moderated_at: new Date().toISOString(), moderated_by: context.userId };
      const { error } = await supabaseAdmin.from("products").update(patch).in("id", data.ids);
      if (error) throw new Error(error.message);
    }
    await logAction(context.userId, `product.bulk_${data.action}`, "product", null, { ids: data.ids, reason: data.reason });
    return { ok: true };
  });

// Разрешённые к правке администратором поля — белый список для защиты от инъекций
const ADMIN_PRODUCT_FIELDS = new Set([
  "title", "description", "price_kopecks", "stock",
  "image_url", "category_id", "is_active", "moderation_status",
  "moderation_reason",
]);

export const updateProductAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.patch)) {
      if (ADMIN_PRODUCT_FIELDS.has(k)) safe[k] = v;
    }
    if (Object.keys(safe).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("products").update(safe as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(context.userId, "product.update", "product", data.id, { patch: safe });
    return { ok: true };
  });

export const deleteProductAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(context.userId, "product.delete", "product", data.id, {});
    return { ok: true };
  });
