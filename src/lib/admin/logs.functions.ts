import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAdminLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { adminId?: string; action?: string; page?: number; pageSize?: number }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const page = data.page ?? 1;
    const size = Math.min(data.pageSize ?? 50, 200);
    const from = (page - 1) * size;
    let q = supabaseAdmin.from("admin_logs").select("*", { count: "exact" });
    if (data.adminId) q = q.eq("admin_id", data.adminId);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    const { data: rows, error, count } = await q.order("created_at", { ascending: false }).range(from, from + size - 1);
    if (error) throw new Error(error.message);
    // Fetch admin names
    const ids = [...new Set((rows ?? []).map((r) => r.admin_id))];
    const { data: names } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] };
    const map = new Map((names ?? []).map((n) => [n.id, n.full_name]));
    const enriched = (rows ?? []).map((r) => ({ ...r, profiles: { full_name: map.get(r.admin_id) ?? null } }));
    return { rows: enriched, total: count ?? 0, page, pageSize: size };
  });
