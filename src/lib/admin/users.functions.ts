import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  created_at: string;
  roles: string[];
};

// Список пользователей с фильтрами, поиском и пагинацией
export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string; role?: string; status?: "active" | "blocked" | "all"; page?: number; pageSize?: number }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const page = data.page ?? 1;
    const size = Math.min(data.pageSize ?? 30, 100);
    const from = (page - 1) * size;

    // Если задан фильтр по роли — сначала берём id пользователей с этой ролью,
    // затем фильтруем profiles по этому набору. Так пагинация не «пустеет».
    let restrictIds: string[] | null = null;
    if (data.role && data.role !== "all") {
      const { data: roleRows } = await supabaseAdmin
        .from("user_roles").select("user_id").eq("role", data.role);
      restrictIds = (roleRows ?? []).map((r) => r.user_id);
      if (restrictIds.length === 0) {
        return { rows: [] as AdminUserRow[], total: 0, page, pageSize: size };
      }
    }

    let query = supabaseAdmin.from("profiles").select("id, full_name, phone, email, is_blocked, blocked_reason, created_at", { count: "exact" });
    if (data.q) {
      const q = data.q.trim();
      query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
    }
    if (data.status === "blocked") query = query.eq("is_blocked", true);
    if (data.status === "active") query = query.eq("is_blocked", false);
    if (restrictIds) query = query.in("id", restrictIds);

    const { data: profiles, error, count } = await query.order("created_at", { ascending: false }).range(from, from + size - 1);
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id);
    const { data: roles } = ids.length
      ? await supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids)
      : { data: [] };
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });

    const rows: AdminUserRow[] = (profiles ?? []).map((p) => ({
      ...p,
      roles: roleMap.get(p.id) ?? [],
    }));

    return { rows, total: count ?? rows.length, page, pageSize: size };
  });

export const setUserBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; blocked: boolean; reason?: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_blocked: data.blocked, blocked_reason: data.blocked ? (data.reason ?? "") : null })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAction(context.userId, data.blocked ? "user.block" : "user.unblock", "user", data.userId, { reason: data.reason });
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "buyer" | "seller" | "admin"; add: boolean }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    if (data.add) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    await logAction(context.userId, data.add ? "user.role_add" : "user.role_remove", "user", data.userId, { role: data.role });
    return { ok: true };
  });

export const getUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const [{ data: profile }, { data: roles }, { data: orders }, { data: products }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
      supabaseAdmin.from("orders").select("id, created_at, total_kopecks, status").eq("buyer_id", data.userId).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("products").select("id, title, price_kopecks, stock, moderation_status, is_active").eq("seller_id", data.userId).order("created_at", { ascending: false }).limit(50),
    ]);
    return {
      profile,
      roles: (roles ?? []).map((r) => r.role),
      orders: orders ?? [],
      products: products ?? [],
    };
  });
