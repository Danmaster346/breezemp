// Аудит попыток злоупотребления при отправке отзыва — только для админов
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export type AbuseLogRow = {
  id: string;
  user_id: string | null;
  reason_code: string;
  message: string | null;
  product_id: string | null;
  order_item_id: string | null;
  created_at: string;
  user_email?: string | null;
  user_name?: string | null;
};

export const listReviewAbuseLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        reason: z.string().optional().nullable(),
        user_id: z.string().uuid().optional().nullable(),
        since: z.enum(["1h", "24h", "7d", "30d", "all"]).default("7d"),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const sinceMs: Record<string, number | null> = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      all: null,
    };
    const sinceIso = sinceMs[data.since]
      ? new Date(Date.now() - (sinceMs[data.since] as number)).toISOString()
      : null;

    let q = supabaseAdmin
      .from("review_abuse_logs")
      .select("id, user_id, reason_code, message, product_id, order_item_id, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false });
    if (sinceIso) q = q.gte("created_at", sinceIso);
    if (data.reason) q = q.eq("reason_code", data.reason);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    const from = (data.page - 1) * data.pageSize;
    q = q.range(from, from + data.pageSize - 1);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    // подтягиваем имена пользователей
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))) as string[];
    let profilesMap = new Map<string, { full_name: string | null }>();
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      profilesMap = new Map((profs ?? []).map((p) => [p.id, { full_name: p.full_name }]));
    }

    // сводки: по причинам и по пользователям (за выбранный период)
    let sumQ = supabaseAdmin
      .from("review_abuse_logs")
      .select("reason_code, user_id");
    if (sinceIso) sumQ = sumQ.gte("created_at", sinceIso);
    const { data: allInWindow } = await sumQ;
    const byReason = new Map<string, number>();
    const byUser = new Map<string, number>();
    for (const r of allInWindow ?? []) {
      byReason.set(r.reason_code, (byReason.get(r.reason_code) ?? 0) + 1);
      if (r.user_id) byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + 1);
    }
    const topUserIds = Array.from(byUser.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    let topUserNames = new Map<string, string | null>();
    if (topUserIds.length) {
      const ids = topUserIds.map(([id]) => id);
      const { data: profs2 } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      topUserNames = new Map((profs2 ?? []).map((p) => [p.id, p.full_name]));
    }

    return {
      rows: (rows ?? []).map((r) => ({
        ...r,
        user_name: r.user_id ? profilesMap.get(r.user_id)?.full_name ?? null : null,
      })) as AbuseLogRow[],
      total: count ?? 0,
      byReason: Array.from(byReason.entries())
        .map(([reason_code, count]) => ({ reason_code, count }))
        .sort((a, b) => b.count - a.count),
      topUsers: topUserIds.map(([id, count]) => ({
        user_id: id,
        count,
        full_name: topUserNames.get(id) ?? null,
      })),
    };
  });
