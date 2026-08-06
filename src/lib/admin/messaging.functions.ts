// Админ: очередь поддержки и жалобы на сообщения.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Доступ только для администратора");
  return supabaseAdmin;
}

export type SupportTicket = {
  id: string;
  user_id: string;
  user_name: string;
  status: "new" | "in_progress" | "closed";
  last_message_at: string;
  last_message_preview: string | null;
};

export const listSupportTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ status: z.enum(["new", "in_progress", "closed", "all"]).default("new") }).parse(d),
  )
  .handler(async ({ context, data }): Promise<SupportTicket[]> => {
    const db = await requireAdmin(context.userId);
    let q = db
      .from("conversations")
      .select("id, buyer_id, support_status, last_message_at, last_message_preview")
      .eq("kind", "support")
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("support_status", data.status);
    const { data: rows } = await q;
    const ids = [...new Set((rows ?? []).map((r) => r.buyer_id))].filter(Boolean) as string[];
    const { data: profiles } = ids.length
      ? await db.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => {
      const p = r.buyer_id ? byId.get(r.buyer_id) : undefined;
      return {
        id: r.id,
        user_id: r.buyer_id ?? "",
        user_name: p?.full_name || p?.email || "Пользователь",
        status: r.support_status as SupportTicket["status"],
        last_message_at: r.last_message_at,
        last_message_preview: r.last_message_preview,
      };
    });
  });

/** Ответ поддержки: админ становится участником диалога и пишет сообщение. */
export const replySupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ conversation_id: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await requireAdmin(context.userId);
    const { data: existing } = await db
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!existing) {
      await db
        .from("conversation_participants")
        .insert({ conversation_id: data.conversation_id, user_id: context.userId, role: "support" });
    }
    const { error } = await db.from("messages").insert({
      conversation_id: data.conversation_id,
      sender_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    await db
      .from("conversations")
      .update({ support_status: "in_progress" })
      .eq("id", data.conversation_id)
      .eq("support_status", "new");
    return { ok: true };
  });

export const getSupportThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const db = await requireAdmin(context.userId);
    const { data: rows } = await db
      .from("messages")
      .select("id, sender_id, body, created_at, is_system")
      .eq("conversation_id", data.conversation_id)
      .order("created_at")
      .limit(200);
    return rows ?? [];
  });

export const setSupportStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        status: z.enum(["new", "in_progress", "closed"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await requireAdmin(context.userId);
    const { error } = await db
      .from("conversations")
      .update({ support_status: data.status })
      .eq("id", data.conversation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type MessageReportRow = {
  id: string;
  message_id: string;
  conversation_id: string;
  reason: string;
  comment: string | null;
  status: string;
  created_at: string;
  reporter_name: string;
  message_body: string | null;
  message_sender_name: string;
  message_hidden: boolean;
};

export const listMessageReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ status: z.enum(["pending", "resolved", "all"]).default("pending") }).parse(d),
  )
  .handler(async ({ context, data }): Promise<MessageReportRow[]> => {
    const db = await requireAdmin(context.userId);
    let q = db
      .from("message_reports")
      .select("id, message_id, conversation_id, reporter_id, reason, comment, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: reports } = await q;
    const rows = reports ?? [];
    if (!rows.length) return [];

    const { data: messages } = await db
      .from("messages")
      .select("id, body, sender_id, is_hidden")
      .in("id", rows.map((r) => r.message_id));
    const msgById = new Map((messages ?? []).map((m) => [m.id, m]));
    const userIds = [
      ...new Set([...rows.map((r) => r.reporter_id), ...(messages ?? []).map((m) => m.sender_id)]),
    ];
    const { data: profiles } = await db.from("profiles").select("id, full_name").in("id", userIds);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name || "Пользователь"]));

    return rows.map((r) => {
      const m = msgById.get(r.message_id);
      return {
        id: r.id,
        message_id: r.message_id,
        conversation_id: r.conversation_id,
        reason: r.reason,
        comment: r.comment,
        status: r.status,
        created_at: r.created_at,
        reporter_name: nameById.get(r.reporter_id) ?? "Пользователь",
        message_body: m?.body ?? null,
        message_sender_name: m ? nameById.get(m.sender_id) ?? "Пользователь" : "—",
        message_hidden: m?.is_hidden ?? false,
      };
    });
  });

export const resolveMessageReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        report_id: z.string().uuid(),
        action: z.enum(["hide", "dismiss", "restore"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await requireAdmin(context.userId);
    const { data: report } = await db
      .from("message_reports")
      .select("id, message_id")
      .eq("id", data.report_id)
      .maybeSingle();
    if (!report) throw new Error("Жалоба не найдена");

    if (data.action === "hide" || data.action === "restore") {
      await db
        .from("messages")
        .update({ is_hidden: data.action === "hide" })
        .eq("id", report.message_id);
    }
    await db
      .from("message_reports")
      .update({
        status: data.action === "dismiss" ? "dismissed" : "resolved",
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.report_id);
    return { ok: true };
  });
