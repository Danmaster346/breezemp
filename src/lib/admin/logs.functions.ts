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
    let q = supabaseAdmin.from("admin_logs").select("*, profiles!admin_logs_admin_id_fkey(full_name)" as never, { count: "exact" });
    if (data.adminId) q = q.eq("admin_id", data.adminId);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    const { data: rows, error, count } = await q.order("created_at", { ascending: false }).range(from, from + size - 1);
    if (error) {
      // fallback without join
      const alt = supabaseAdmin.from("admin_logs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + size - 1);
      const { data: r2, error: e2, count: c2 } = await alt;
      if (e2) throw new Error(e2.message);
      return { rows: r2 ?? [], total: c2 ?? 0, page, pageSize: size };
    }
    return { rows: rows ?? [], total: count ?? 0, page, pageSize: size };
  });
