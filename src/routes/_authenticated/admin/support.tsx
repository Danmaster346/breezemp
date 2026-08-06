// Админ: очередь обращений в поддержку Kupiks
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getSupportThread,
  listSupportTickets,
  replySupportTicket,
  setSupportStatus,
  type SupportTicket,
} from "@/lib/admin/messaging.functions";
import { Headphones, Loader2, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/support")({
  head: () => ({ meta: [{ title: "Поддержка — Админ Kupiks" }] }),
  component: AdminSupport,
});

const STATUSES = [
  { k: "new", label: "Новые" },
  { k: "in_progress", label: "В работе" },
  { k: "closed", label: "Закрытые" },
  { k: "all", label: "Все" },
] as const;

function AdminSupport() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listSupportTickets);
  const fetchThread = useServerFn(getSupportThread);
  const reply = useServerFn(replySupportTicket);
  const setStatus = useServerFn(setSupportStatus);

  const [status, setStatusFilter] = useState<(typeof STATUSES)[number]["k"]>("new");
  const [active, setActive] = useState<SupportTicket | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const list = useQuery({
    queryKey: ["admin-support", status],
    queryFn: () => fetchList({ data: { status } }),
    refetchInterval: 20_000,
  });

  const thread = useQuery({
    queryKey: ["admin-support-thread", active?.id],
    enabled: !!active,
    queryFn: () => fetchThread({ data: { conversation_id: active!.id } }),
    refetchInterval: 10_000,
  });

  const send = async () => {
    if (!active || !text.trim()) return;
    setSending(true);
    try {
      await reply({ data: { conversation_id: active.id, body: text.trim() } });
      setText("");
      qc.invalidateQueries({ queryKey: ["admin-support-thread", active.id] });
      qc.invalidateQueries({ queryKey: ["admin-support", status] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (s: "new" | "in_progress" | "closed") => {
    if (!active) return;
    try {
      await setStatus({ data: { conversation_id: active.id, status: s } });
      toast.success("Статус обновлён");
      qc.invalidateQueries({ queryKey: ["admin-support", status] });
      setActive({ ...active, status: s });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Headphones className="h-5 w-5 text-brand" />
        <h1 className="text-xl font-bold">Обращения в поддержку</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.k}
            onClick={() => setStatusFilter(s.k)}
            className={`h-9 rounded-full border px-4 text-sm font-medium transition ${
              status === s.k ? "border-foreground bg-foreground text-background" : "bg-white hover:border-foreground/40"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="overflow-hidden rounded-2xl border bg-white">
          {list.isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Загрузка…</div>
          ) : (list.data ?? []).length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Обращений нет</div>
          ) : (
            <ul className="divide-y">
              {(list.data ?? []).map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActive(t)}
                    className={`w-full p-3 text-left transition hover:bg-surface ${
                      active?.id === t.id ? "bg-surface" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{t.user_name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {new Date(t.last_message_at).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.last_message_preview ?? "Нет сообщений"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border bg-white">
          {!active ? (
            <div className="grid flex-1 place-items-center p-8 text-sm text-muted-foreground">
              Выберите обращение слева
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                <div className="font-semibold">{active.user_name}</div>
                <div className="flex gap-1.5">
                  {(["in_progress", "closed"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void changeStatus(s)}
                      className={`h-8 rounded-full border px-3 text-xs font-medium hover:border-brand ${
                        active.status === s ? "border-brand text-brand" : ""
                      }`}
                    >
                      {s === "in_progress" ? "В работе" : "Закрыть"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto bg-surface p-3">
                {thread.isLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  (thread.data ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        m.sender_id === active.user_id
                          ? "border bg-white"
                          : "ml-auto bg-brand text-brand-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <div className="mt-1 text-[11px] opacity-70">
                        {new Date(m.created_at).toLocaleString("ru-RU")}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-end gap-2 border-t p-3">
                <textarea
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ответ пользователю…"
                  className="flex-1 resize-none rounded-xl border p-2.5 text-sm outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sending}
                  className="grid h-10 w-10 place-items-center rounded-full bg-brand text-brand-foreground disabled:opacity-50"
                  aria-label="Отправить"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
