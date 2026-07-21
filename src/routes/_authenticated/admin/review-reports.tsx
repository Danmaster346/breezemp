// Очередь жалоб на отзывы
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listReviewReports,
  resolveReviewReport,
} from "@/lib/admin/review-reports.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, EyeOff, Check, XCircle, Trash2, Flag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/review-reports")({
  component: ReviewReportsPage,
});

const REASON_LABEL: Record<string, string> = {
  spam: "Спам/реклама",
  offensive: "Оскорбления",
  fake: "Фейк",
  off_topic: "Не по теме",
  personal_info: "Персональные данные",
  other: "Другое",
};

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: "На модерации", className: "bg-amber-100 text-amber-800" },
  resolved_hidden: { label: "Отзыв скрыт", className: "bg-red-100 text-red-800" },
  resolved_kept: { label: "Отзыв оставлен", className: "bg-emerald-100 text-emerald-800" },
  dismissed: { label: "Жалоба отклонена", className: "bg-slate-100 text-slate-700" },
};

type Row = {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: string;
  comment: string | null;
  status: string;
  created_at: string;
  reports_count: number;
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    author_name: string | null;
    is_hidden: boolean;
    user_id: string;
    product_id: string;
    products: { title: string } | null;
  } | null;
};

function ReviewReportsPage() {
  const list = useServerFn(listReviewReports);
  const resolve = useServerFn(resolveReviewReport);
  const qc = useQueryClient();
  const [status, setStatus] = useState<
    "all" | "pending" | "resolved_hidden" | "resolved_kept" | "dismissed"
  >("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-review-reports", status],
    queryFn: () => list({ data: { status, page: 1, pageSize: 50 } }),
  });

  const resolveM = useMutation({
    mutationFn: resolve,
    onSuccess: () => {
      toast.success("Готово");
      qc.invalidateQueries({ queryKey: ["admin-review-reports"] });
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (data?.rows ?? []) as unknown as Row[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6 text-destructive" />
            Жалобы на отзывы
          </h1>
          <p className="text-foreground/60 text-sm mt-1">
            На модерации: <span className="font-semibold text-foreground">{data?.pendingTotal ?? 0}</span>
            {" · "}Всего жалоб: {data?.totalAll ?? 0}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 p-2 flex flex-wrap gap-1">
        {(["pending", "resolved_hidden", "resolved_kept", "dismissed", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              status === s ? "bg-brand text-brand-foreground" : "text-foreground/70 hover:bg-surface"
            }`}
          >
            {s === "all" ? "Все" : STATUS_LABEL[s].label}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        {isLoading ? (
          <div className="rounded-2xl bg-white p-8 text-center text-foreground/60">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-foreground/60">
            Жалоб в этой очереди нет
          </div>
        ) : (
          rows.map((r) => {
            const s = STATUS_LABEL[r.status] ?? { label: r.status, className: "bg-slate-100" };
            const rv = r.reviews;
            return (
              <div key={r.id} className="rounded-2xl bg-white border border-border/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge className={s.className}>{s.label}</Badge>
                      <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-medium">
                        {REASON_LABEL[r.reason] ?? r.reason}
                      </span>
                      {r.reports_count > 1 && (
                        <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-medium">
                          {r.reports_count} жалоб на этот отзыв
                        </span>
                      )}
                      <span className="text-foreground/50">
                        {new Date(r.created_at).toLocaleString("ru-RU")}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="text-sm mt-2 text-foreground/80 italic">
                        «{r.comment}»
                      </p>
                    )}

                    {rv ? (
                      <div className="mt-3 rounded-xl bg-surface border border-border/60 p-3">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${
                                  i <= rv.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-foreground/20"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-medium">{rv.author_name ?? "—"}</span>
                          {rv.is_hidden && (
                            <Badge variant="secondary" className="text-[10px]">
                              Скрыт
                            </Badge>
                          )}
                          <span className="text-foreground/50">
                            Товар: {rv.products?.title ?? "—"}
                          </span>
                        </div>
                        <p className="text-sm mt-2">{rv.comment ?? "—"}</p>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-foreground/50">Отзыв удалён</div>
                    )}
                  </div>

                  {r.status === "pending" && rv && (
                    <div className="flex flex-col gap-1.5 shrink-0 w-full sm:w-auto">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          resolveM.mutate({ data: { report_id: r.id, action: "hide" } })
                        }
                      >
                        <EyeOff className="h-4 w-4 mr-1.5" /> Скрыть отзыв
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          resolveM.mutate({ data: { report_id: r.id, action: "keep" } })
                        }
                      >
                        <Check className="h-4 w-4 mr-1.5" /> Оставить
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          resolveM.mutate({ data: { report_id: r.id, action: "dismiss" } })
                        }
                      >
                        <XCircle className="h-4 w-4 mr-1.5" /> Отклонить жалобу
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Удалить отзыв полностью?"))
                            resolveM.mutate({ data: { report_id: r.id, action: "delete" } });
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" /> Удалить отзыв
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
