import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAdminCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("categories").select("*").order("sort_order").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; slug: string; icon?: string | null; icon_url?: string | null; sort_order?: number }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const payload = {
      name: data.name,
      slug: data.slug,
      icon: data.icon ?? null,
      icon_url: data.icon_url ?? null,
      sort_order: data.sort_order ?? 0,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("categories").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAction(context.userId, "category.update", "category", data.id, payload);
    } else {
      const { data: created, error } = await supabaseAdmin.from("categories").insert(payload).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      await logAction(context.userId, "category.create", "category", created?.id ?? null, payload);
    }
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(context.userId, "category.delete", "category", data.id, {});
    return { ok: true };
  });

export const reorderCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderedIds: string[] }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    await Promise.all(
      data.orderedIds.map((id, i) =>
        supabaseAdmin.from("categories").update({ sort_order: i }).eq("id", id),
      ),
    );
    await logAction(context.userId, "category.reorder", "category", null, { ids: data.orderedIds });
    return { ok: true };
  });
