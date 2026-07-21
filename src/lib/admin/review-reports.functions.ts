// Админ: очередь жалоб на отзывы
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listReviewReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        status: z.enum(["all", "pending", "resolved_hidden", "resolved_kept", "dismissed"]).default("pending"),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(30),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const from = (data.page - 1) * data.pageSize;

    let q = supabaseAdmin
      .from("review_reports")
      .select(
        "id, review_id, reporter_id, reason, comment, status, resolved_by, resolved_at, created_at, reviews(id, rating, comment, author_name, is_hidden, user_id, product_id, products(title))",
        { count: "exact" },
      );
    if (data.status !== "all") q = q.eq("status", data.status);

    const { data: rows, error, count } = await q
      .order("created_at", { ascending: false })
      .range(from, from + data.pageSize - 1);
    if (error) throw new Error(error.message);

    // Собираем количество жалоб на каждый отзыв (для тех, что в выдаче)
    const reviewIds = Array.from(new Set((rows ?? []).map((r) => r.review_id).filter(Boolean)));
    let counts: Record<string, number> = {};
    if (reviewIds.length) {
      const { data: allForReviews } = await supabaseAdmin
        .from("review_reports")
        .select("review_id")
        .in("review_id", reviewIds);
      for (const r of allForReviews ?? []) {
        counts[r.review_id] = (counts[r.review_id] ?? 0) + 1;
      }
    }

    // Стата очереди
    const [{ count: pendingTotal }, { count: totalAll }] = await Promise.all([
      supabaseAdmin.from("review_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("review_reports").select("id", { count: "exact", head: true }),
    ]);

    return {
      rows: (rows ?? []).map((r) => ({ ...r, reports_count: counts[r.review_id] ?? 1 })),
      total: count ?? 0,
      pendingTotal: pendingTotal ?? 0,
      totalAll: totalAll ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const resolveReviewReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        report_id: z.string().uuid(),
        action: z.enum(["hide", "keep", "dismiss", "delete"]),
        note: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);

    const { data: report, error: repErr } = await supabaseAdmin
      .from("review_reports")
      .select("id, review_id, status")
      .eq("id", data.report_id)
      .maybeSingle();
    if (repErr) throw new Error(repErr.message);
    if (!report) throw new Error("Жалоба не найдена");

    const now = new Date().toISOString();

    if (data.action === "hide") {
      const { error: hideErr } = await supabaseAdmin
        .from("reviews")
        .update({ is_hidden: true })
        .eq("id", report.review_id);
      if (hideErr) throw new Error(hideErr.message);
      // Закрываем все жалобы на этот отзыв как resolved_hidden
      await supabaseAdmin
        .from("review_reports")
        .update({ status: "resolved_hidden", resolved_by: context.userId, resolved_at: now })
        .eq("review_id", report.review_id)
        .in("status", ["pending"]);
      await logAction(context.userId, "review_report.hide", "review", report.review_id, { report_id: report.id, note: data.note ?? null });
      return { ok: true };
    }

    if (data.action === "delete") {
      const { error: delErr } = await supabaseAdmin.from("reviews").delete().eq("id", report.review_id);
      if (delErr) throw new Error(delErr.message);
      await logAction(context.userId, "review_report.delete_review", "review", report.review_id, { report_id: report.id, note: data.note ?? null });
      return { ok: true };
    }

    // keep = отзыв оставить видимым, dismiss = жалобу отклонить
    const newStatus = data.action === "keep" ? "resolved_kept" : "dismissed";
    const { error: updErr } = await supabaseAdmin
      .from("review_reports")
      .update({ status: newStatus, resolved_by: context.userId, resolved_at: now })
      .eq("id", report.id);
    if (updErr) throw new Error(updErr.message);
    await logAction(context.userId, `review_report.${newStatus}`, "review_report", report.id, { review_id: report.review_id, note: data.note ?? null });
    return { ok: true };
  });
