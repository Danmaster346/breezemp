// Админ: рассылки уведомлений пользователям
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AdminNotificationRow = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  target: string;
  type: string;
  recipients_count: number;
  sent_at: string;
};

// История рассылок с пагинацией
export const listAdminNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { page?: number; pageSize?: number }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const page = data.page ?? 1;
    const size = Math.min(data.pageSize ?? 20, 100);
    const from = (page - 1) * size;

    const { data: rows, error, count } = await supabaseAdmin
      .from("admin_notifications")
      .select("id, title, body, link, target, type, recipients_count, sent_at", { count: "exact" })
      .order("sent_at", { ascending: false })
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);

    return { rows: (rows ?? []) as AdminNotificationRow[], total: count ?? 0, page, pageSize: size };
  });

// Поиск получателей для конкретной адресной рассылки
export const searchNotificationRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const q = data.q.trim();
    if (!q) return [] as { id: string; full_name: string | null; email: string | null }[];

    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Отправка рассылки: вычисление получателей, запись истории и персональных уведомлений
export const sendAdminNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().trim().min(1).max(100),
        body: z.string().trim().min(1).max(500),
        link: z.string().trim().max(500).optional().nullable(),
        target: z.string().min(1),
        type: z.enum(["info", "promo", "important", "warning"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);

    let recipientIds: string[] = [];

    if (data.target === "all" || data.target === "buyers") {
      const { data: allProfiles, error } = await supabaseAdmin.from("profiles").select("id");
      if (error) throw new Error(error.message);
      const allIds = (allProfiles ?? []).map((p) => p.id);

      if (data.target === "all") {
        recipientIds = allIds;
      } else {
        const { data: sellerRows } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "seller");
        const sellerIds = new Set((sellerRows ?? []).map((r) => r.user_id));
        recipientIds = allIds.filter((id) => !sellerIds.has(id));
      }
    } else if (data.target === "sellers") {
      const { data: sellerRows, error } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "seller");
      if (error) throw new Error(error.message);
      recipientIds = (sellerRows ?? []).map((r) => r.user_id);
    } else {
      // конкретный пользователь по uuid
      const parsed = z.string().uuid().safeParse(data.target);
      if (!parsed.success) throw new Error("Некорректный получатель");
      recipientIds = [data.target];
    }

    recipientIds = [...new Set(recipientIds)];
    const recipientsCount = recipientIds.length;

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("admin_notifications")
      .insert({
        title: data.title,
        body: data.body,
        link: data.link || null,
        target: data.target,
        type: data.type,
        sent_by: context.userId,
        recipients_count: recipientsCount,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    const notificationId = inserted.id;

    const BATCH = 500;
    for (let i = 0; i < recipientIds.length; i += BATCH) {
      const chunk = recipientIds.slice(i, i + BATCH).map((userId) => ({
        user_id: userId,
        notification_id: notificationId,
        title: data.title,
        body: data.body,
        link: data.link || null,
        type: data.type,
      }));
      if (chunk.length === 0) continue;
      const { error: uErr } = await supabaseAdmin.from("user_notifications").insert(chunk);
      if (uErr) throw new Error(uErr.message);
    }

    await logAction(context.userId, "notification.send", "admin_notification", notificationId, {
      target: data.target,
      type: data.type,
      title: data.title,
      recipients_count: recipientsCount,
    });

    return { recipients_count: recipientsCount };
  });
