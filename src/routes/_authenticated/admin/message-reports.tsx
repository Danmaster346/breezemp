// Админ: жалобы на сообщения в чатах
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listMessageReports, resolveMessageReport } from "@/lib/admin/messaging.functions";
import { EyeOff, MessageSquareWarning, RotateCcw, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/message-reports")({
  head: () => ({ meta: [{ title: "Жалобы на сообщения — Админ Kupiks" }] }),
  component: AdminMessageReports,
});

const REASON_LABEL: Record<string, string> = {
  spam: "Спам",
  abuse: "Оскорбления",
  fraud: "Мошенничество",
  offsite: "Сделка вне Kupiks",
  other: "Другое",
};

const FILTERS = [
  { k: "pending", label: "Новые" },
  { k: "resolved", label: "Обработанные" },
  { k: "all", label: "Все" },
] as const;

function AdminMessageReports() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listMessageReports);
  const resolve = useServerFn(resolveMessageReport);
  const [status, setStatus] = useState<(typeof FILTERS)[number]["k"]>("pending");

  const q = useQuery({
    queryKey: ["admin-message-reports", status],
    queryFn: () => fetchList({ data: { status } }),
  });

  const act = async (id: string, action: "hide" | "dismiss" | "restore") => {
    try {
      await resolve({ data: { report_id: id, action } });
      toast.success(
        action === "hide" ? "Сообщение скрыто" : action === "restore" ? "Сообщение восстановлено" : "Жалоба отклонена",
      );
      qc.invalidateQueries({ queryKey: ["admin-message-reports"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquareWarning className="h-5 w-5 text-brand" />
        <h1 className="text-xl font-bold">Жалобы на сообщения</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.k}
            onClick={() => setStatus(f.k)}
            className={`h-9 rounded-full border px-4 text-sm font-medium transition ${
              status === f.k ? "border-foreground bg-foreground text-background" : "bg-white hover:border-foreground/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="rounded-2xl border bg-white p-6 text-center text-sm text-muted-foreground">Загрузка…</div>
      ) : (q.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Жалоб нет</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(q.data ?? []).map((r) => (
            <li key={r.id} className="rounded-2xl border bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-surface px-2.5 py-1 font-medium text-foreground">
                  {REASON_LABEL[r.reason] ?? r.reason}
                </span>
                <span>от {r.reporter_name}</span>
                <span>· {new Date(r.created_at).toLocaleString("ru-RU")}</span>
                {r.message_hidden && (
                  <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-600">скрыто</span>
                )}
              </div>

              <div className="rounded-xl border bg-surface p-3 text-sm">
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Автор: {r.message_sender_name}
                </div>
                <p className="whitespace-pre-wrap break-words">{r.message_body ?? "— (без текста)"}</p>
              </div>

              {r.comment && (
                <p className="mt-2 text-sm text-muted-foreground">Комментарий: {r.comment}</p>
              )}

              {r.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void act(r.id, "hide")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-red-600 px-4 text-xs font-medium text-white hover:opacity-90"
                  >
                    <EyeOff className="h-3.5 w-3.5" /> Скрыть сообщение
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(r.id, "dismiss")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-xs font-medium hover:border-brand"
                  >
                    Отклонить жалобу
                  </button>
                </div>
              )}
              {r.status !== "pending" && r.message_hidden && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => void act(r.id, "restore")}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-xs font-medium hover:border-brand"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Восстановить
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
