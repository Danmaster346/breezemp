// Диалог: лента сообщений с пагинацией, realtime, ответы/редактирование/жалобы.
import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { MessageBubble } from "@/components/messaging/MessageBubble";
import { ChatComposer, type PendingAttachment } from "@/components/messaging/ChatComposer";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteMessage,
  editMessage,
  getConversationHeader,
  getMessages,
  listQuickReplies,
  markConversationRead,
  reportMessage,
  sendMessage,
} from "@/lib/messaging/messaging.functions";
import type { ChatMessage } from "@/lib/messaging/types";
import { friendlyMessagingError } from "@/lib/messaging/types";
import { ArrowLeft, Headphones, Loader2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages/$conversationId")({
  head: () => ({ meta: [{ title: "Диалог — Kupiks" }] }),
  component: ConversationPage,
});

const REPORT_REASONS = [
  { value: "spam", label: "Спам или реклама" },
  { value: "abuse", label: "Оскорбления" },
  { value: "fraud", label: "Мошенничество" },
  { value: "offsite", label: "Сделка вне Kupiks" },
  { value: "other", label: "Другое" },
] as const;

function dayLabel(dt: string) {
  const d = new Date(dt);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Сегодня";
  if (d.toDateString() === yesterday.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchHeader = useServerFn(getConversationHeader);
  const fetchMessages = useServerFn(getMessages);
  const fetchQuick = useServerFn(listQuickReplies);
  const send = useServerFn(sendMessage);
  const edit = useServerFn(editMessage);
  const remove = useServerFn(deleteMessage);
  const markRead = useServerFn(markConversationRead);
  const report = useServerFn(reportMessage);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialLoaded = useRef(false);

  const header = useQuery({
    queryKey: ["conversation-header", conversationId],
    queryFn: () => fetchHeader({ data: { conversation_id: conversationId } }),
    refetchInterval: 5000,
  });

  const quick = useQuery({
    queryKey: ["quick-replies", user?.id],
    enabled: header.data?.my_role === "seller",
    queryFn: () => fetchQuick(),
  });

  const loadInitial = useCallback(async () => {
    const res = await fetchMessages({ data: { conversation_id: conversationId } });
    setMessages(res.messages);
    setHasMore(res.hasMore);
    initialLoaded.current = true;
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end" }));
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    initialLoaded.current = false;
    setMessages([]);
    loadInitial().catch((e) => toast.error(friendlyMessagingError(e)));
  }, [loadInitial]);

  useEffect(() => {
    markRead({ data: { conversation_id: conversationId } })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["unread-chats", user?.id] });
        qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
      })
      .catch(() => {});
  }, [conversationId, markRead, qc, user?.id, messages.length]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`conv-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          () => {
            fetchMessages({ data: { conversation_id: conversationId } })
              .then((res) => {
                setMessages(res.messages);
                setHasMore(res.hasMore);
                const el = scrollRef.current;
                const nearBottom =
                  !el || el.scrollHeight - el.scrollTop - el.clientHeight < 200;
                if (nearBottom) {
                  requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
                }
              })
              .catch(() => {});
          },
        )
        .subscribe();
    } catch (error) {
      console.warn("[conversation] realtime disabled", error);
    }
    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, [conversationId, user, fetchMessages]);

  const loadMore = async () => {
    const oldest = messages[0];
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const res = await fetchMessages({
        data: { conversation_id: conversationId, before: oldest.created_at },
      });
      setMessages((prev) => [...res.messages, ...prev]);
      setHasMore(res.hasMore);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch (e) {
      toast.error(friendlyMessagingError(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSend = async ({
    body,
    attachments,
  }: {
    body: string;
    attachments: PendingAttachment[];
  }) => {
    try {
      const res = await send({
        data: {
          conversation_id: conversationId,
          body: body || undefined,
          reply_to_id: replyTo?.id,
          context_type: replyTo ? undefined : undefined,
          attachments,
        },
      });
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
    } catch (e) {
      toast.error(friendlyMessagingError(e));
      throw e;
    }
  };

  const handleSaveEdit = async (body: string) => {
    if (!editingMsg) return;
    try {
      await edit({ data: { message_id: editingMsg.id, body } });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMsg.id ? { ...m, body, edited_at: new Date().toISOString() } : m,
        ),
      );
      toast.success("Сообщение изменено");
    } catch (e) {
      toast.error(friendlyMessagingError(e));
      throw e;
    }
  };

  const handleDelete = async (m: ChatMessage) => {
    try {
      await remove({ data: { message_id: m.id } });
      setMessages((prev) =>
        prev.map((x) =>
          x.id === m.id ? { ...x, body: null, attachments: [], deleted_at: new Date().toISOString() } : x,
        ),
      );
    } catch (e) {
      toast.error(friendlyMessagingError(e));
    }
  };

  const submitReport = async (reason: (typeof REPORT_REASONS)[number]["value"], comment: string) => {
    if (!reportTarget) return;
    try {
      await report({ data: { message_id: reportTarget.id, reason, comment: comment || undefined } });
      toast.success("Жалоба отправлена. Модератор проверит сообщение");
      setReportTarget(null);
    } catch (e) {
      toast.error(friendlyMessagingError(e));
    }
  };

  const h = header.data;

  return (
    <AppLayout hideMobileBottomNav>
      <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-3xl flex-col md:h-[calc(100vh-8rem)] md:py-4">
        <div className="flex flex-1 flex-col overflow-hidden border-x bg-surface md:rounded-2xl md:border md:shadow-sm">
          {/* Шапка */}
          <div className="flex items-center gap-3 border-b bg-white px-3 py-2.5">
            <button
              type="button"
              onClick={() => navigate({ to: "/messages" })}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface"
              aria-label="Назад"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            {h?.kind === "support" ? (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <Headphones className="h-5 w-5" />
              </div>
            ) : h?.peer_logo_url ? (
              <img src={h.peer_logo_url} alt="" className="h-10 w-10 shrink-0 rounded-full border object-cover" />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand">
                {(h?.peer_name ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{h?.peer_name ?? "Загрузка…"}</div>
              <div className="text-xs text-muted-foreground">
                {h?.peer_typing
                  ? "печатает…"
                  : h?.kind === "support"
                    ? "Служба поддержки Kupiks"
                    : h?.my_role === "buyer"
                      ? "Продавец"
                      : "Покупатель"}
              </div>
            </div>
            {h?.kind !== "support" && h?.peer_id && h.my_role === "buyer" && (
              <Link
                to="/seller/$id"
                params={{ id: h.peer_id }}
                className="hidden rounded-full border px-3 py-1.5 text-xs hover:border-brand md:block"
              >
                Профиль
              </Link>
            )}
          </div>

          {/* Лента */}
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
            {hasMore && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="rounded-full border bg-white px-4 py-1.5 text-xs hover:border-brand disabled:opacity-60"
                >
                  {loadingMore ? "Загрузка…" : "Показать ещё"}
                </button>
              </div>
            )}

            {!initialLoaded.current ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Пока нет сообщений. Напишите первым — обычно отвечают в течение дня.
              </div>
            ) : (
              messages.map((m, i) => {
                const prev = messages[i - 1];
                const showDay =
                  !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                return (
                  <div key={m.id} className="space-y-2">
                    {showDay && (
                      <div className="flex justify-center py-1">
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
                          {dayLabel(m.created_at)}
                        </span>
                      </div>
                    )}
                    <MessageBubble
                      m={m}
                      mine={m.sender_id === user?.id && !m.is_system}
                      onReply={setReplyTo}
                      onEdit={setEditingMsg}
                      onDelete={(x) => void handleDelete(x)}
                      onReport={setReportTarget}
                    />
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <ChatComposer
            conversationId={conversationId}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            editing={editingMsg}
            onCancelEdit={() => setEditingMsg(null)}
            quickReplies={quick.data ?? []}
            onSend={handleSend}
            onSaveEdit={handleSaveEdit}
          />
        </div>
      </div>

      {reportTarget && (
        <ReportDialog
          onClose={() => setReportTarget(null)}
          onSubmit={(reason, comment) => void submitReport(reason, comment)}
        />
      )}
    </AppLayout>
  );
}

function ReportDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (reason: (typeof REPORT_REASONS)[number]["value"], comment: string) => void;
}) {
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["value"]>("spam");
  const [comment, setComment] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-brand" />
          <h2 className="font-semibold">Пожаловаться на сообщение</h2>
        </div>
        <div className="space-y-2">
          {REPORT_REASONS.map((r) => (
            <label key={r.value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="reason"
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
              />
              {r.label}
            </label>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Комментарий (необязательно)"
          className="mt-3 w-full resize-none rounded-xl border p-3 text-sm outline-none focus:border-brand"
        />
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-full border text-sm font-medium hover:bg-surface"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onSubmit(reason, comment)}
            className="h-10 flex-1 rounded-full bg-brand text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
}
