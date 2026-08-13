// Всплывающая панель «Сообщения»: список диалогов (поиск + фильтры) и чат внутри той же панели.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  BellOff,
  ExternalLink,
  Headphones,
  Loader2,
  MessageCircle,
  Pin,
  PinOff,
  Search,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MessageBubble } from "@/components/messaging/MessageBubble";
import { ChatComposer, type PendingAttachment } from "@/components/messaging/ChatComposer";
import { useAuth } from "@/lib/use-auth";
import { usePanels } from "@/lib/panels-store";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteMessage,
  editMessage,
  getConversationHeader,
  getMessages,
  listConversations,
  listQuickReplies,
  markConversationRead,
  openConversation,
  sendMessage,
  updateConversationFlags,
} from "@/lib/messaging/messaging.functions";
import type { ChatMessage, ConversationSummary } from "@/lib/messaging/types";
import { friendlyMessagingError } from "@/lib/messaging/types";

type FilterKey = "all" | "unread" | "buyer" | "seller" | "support" | "archived";

function fmt(dt: string) {
  const d = new Date(dt);
  const now = new Date();
  const day = 86400000;
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (now.getTime() - d.getTime() < 2 * day) return "Вчера";
  if (now.getTime() - d.getTime() < 7 * day) return d.toLocaleDateString("ru-RU", { weekday: "short" });
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function MessagesPanel() {
  const { user } = useAuth();
  const open = usePanels((s) => s.messagesOpen);
  const close = usePanels((s) => s.closeMessages);
  const conversationId = usePanels((s) => s.conversationId);
  const setConversation = usePanels((s) => s.setConversation);

  return (
    <Sheet open={open && !!user} onOpenChange={(v) => (v ? null : close())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md md:max-w-lg"
        aria-describedby={undefined}
      >
        {conversationId ? (
          <PanelChat conversationId={conversationId} onBack={() => setConversation(null)} />
        ) : (
          <PanelList onOpen={(id) => setConversation(id)} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PanelList({ onOpen }: { onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchList = useServerFn(listConversations);
  const openConv = useServerFn(openConversation);
  const setFlags = useServerFn(updateConversationFlags);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const q = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: () => fetchList(),
    refetchInterval: 20_000,
  });

  const all = q.data ?? [];
  const counts = useMemo(
    () => ({
      all: all.filter((c) => !c.is_archived).length,
      unread: all.filter((c) => c.unread > 0 && !c.is_archived).length,
      buyer: all.filter((c) => c.my_role === "buyer" && c.kind === "deal" && !c.is_archived).length,
      seller: all.filter((c) => c.my_role === "seller" && !c.is_archived).length,
      support: all.filter((c) => c.kind === "support").length,
      archived: all.filter((c) => c.is_archived).length,
    }),
    [all],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return all.filter((c) => {
      if (filter === "archived") {
        if (!c.is_archived) return false;
      } else if (c.is_archived) return false;
      if (filter === "unread" && c.unread === 0) return false;
      if (filter === "buyer" && !(c.my_role === "buyer" && c.kind === "deal")) return false;
      if (filter === "seller" && c.my_role !== "seller") return false;
      if (filter === "support" && c.kind !== "support") return false;
      if (term && !`${c.peer_name} ${c.last_message_preview ?? ""}`.toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [all, filter, query]);

  const openSupport = async () => {
    try {
      const res = await openConv({ data: { support: true } });
      onOpen(res.id);
    } catch {
      toast.error("Не удалось открыть обращение в поддержку");
    }
  };

  const toggle = async (c: ConversationSummary, patch: { is_pinned?: boolean; is_archived?: boolean }) => {
    try {
      await setFlags({ data: { conversation_id: c.id, ...patch } });
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
    } catch {
      toast.error("Не удалось обновить диалог");
    }
  };

  return (
    <>
      <div className="border-b border-border px-4 pb-3 pt-5">
        <div className="mb-3 flex items-center gap-2 pr-8">
          <MessageCircle className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-bold tracking-tight">Сообщения</h2>
          {counts.unread > 0 && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-brand-foreground">
              {counts.unread}
            </span>
          )}
          <button
            type="button"
            onClick={() => void openSupport()}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:border-brand ui-transition"
          >
            <Headphones className="h-3.5 w-3.5" />
            Поддержка
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или сообщению"
            className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-10 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full hover:bg-surface"
              aria-label="Очистить"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
          {(
            [
              { k: "all", label: "Все", n: counts.all },
              { k: "unread", label: "Непрочитанные", n: counts.unread },
              { k: "buyer", label: "Мои покупки", n: counts.buyer },
              { k: "seller", label: "Мои продажи", n: counts.seller },
              { k: "support", label: "Поддержка", n: counts.support },
              { k: "archived", label: "Архив", n: counts.archived },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setFilter(t.k)}
              className={`h-8 shrink-0 rounded-full border px-3 text-xs font-semibold ui-transition ${
                filter === t.k
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:border-foreground/40"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 ${filter === t.k ? "opacity-70" : "text-muted-foreground"}`}>
                {t.n}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {q.isLoading ? (
          <ul className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex animate-pulse items-center gap-3 p-4">
                <div className="h-11 w-11 rounded-full bg-surface" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-surface" />
                  <div className="h-3 w-2/3 rounded bg-surface" />
                </div>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
              <MessageCircle className="h-6 w-6" />
            </div>
            <p className="font-semibold">
              {query ? "Ничего не найдено" : all.length ? "В этой категории пусто" : "Пока нет сообщений"}
            </p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              {query
                ? "Попробуйте изменить запрос"
                : "Напишите продавцу с карточки товара или из заказа — переписка появится здесь."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center gap-1 hover:bg-surface ui-transition">
                <button
                  type="button"
                  onClick={() => onOpen(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
                >
                  <div className="relative shrink-0">
                    {c.kind === "support" ? (
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">
                        <Headphones className="h-5 w-5" />
                      </div>
                    ) : c.peer_logo_url ? (
                      <img
                        src={c.peer_logo_url}
                        alt=""
                        loading="lazy"
                        className="h-11 w-11 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft font-semibold text-brand">
                        {c.peer_name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    {c.kind === "deal" && (
                      <div className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border border-border bg-background">
                        {c.my_role === "buyer" ? (
                          <Store className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div
                        className={`flex min-w-0 items-center gap-1.5 ${c.unread ? "font-semibold" : "font-medium"}`}
                      >
                        {c.is_pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-brand" />}
                        <span className="truncate">{c.peer_name}</span>
                        {c.muted && <BellOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      </div>
                      <span
                        className={`shrink-0 text-xs ${c.unread ? "font-medium text-brand" : "text-muted-foreground"}`}
                      >
                        {fmt(c.last_message_at)}
                      </span>
                    </div>
                    <div
                      className={`mt-0.5 truncate text-sm ${
                        c.unread ? "font-medium text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {c.last_message_preview
                        ? `${c.last_sender_id === user?.id ? "Вы: " : ""}${c.last_message_preview}`
                        : "Нет сообщений"}
                    </div>
                  </div>

                  {c.unread > 0 && (
                    <span className="grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-foreground">
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </button>

                <div className="flex shrink-0 flex-col pr-2">
                  <button
                    type="button"
                    onClick={() => void toggle(c, { is_pinned: !c.is_pinned })}
                    title={c.is_pinned ? "Открепить" : "Закрепить"}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-card"
                  >
                    {c.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggle(c, { is_archived: !c.is_archived })}
                    title={c.is_archived ? "Вернуть из архива" : "В архив"}
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-card"
                  >
                    {c.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border p-3">
        <Link
          to="/messages"
          onClick={() => usePanels.getState().closeMessages()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-brand ui-transition"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Открыть на отдельной странице
        </Link>
      </div>
    </>
  );
}

function PanelChat({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const fetchHeader = useServerFn(getConversationHeader);
  const fetchMessages = useServerFn(getMessages);
  const fetchQuick = useServerFn(listQuickReplies);
  const send = useServerFn(sendMessage);
  const edit = useServerFn(editMessage);
  const remove = useServerFn(deleteMessage);
  const markRead = useServerFn(markConversationRead);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const header = useQuery({
    queryKey: ["conversation-header", conversationId],
    queryFn: () => fetchHeader({ data: { conversation_id: conversationId } }),
    refetchInterval: 10_000,
  });

  const quick = useQuery({
    queryKey: ["quick-replies", user?.id],
    enabled: header.data?.my_role === "seller",
    queryFn: () => fetchQuick(),
  });

  const load = useCallback(async () => {
    const res = await fetchMessages({ data: { conversation_id: conversationId } });
    setMessages(res.messages);
    setHasMore(res.hasMore);
    setLoading(false);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end" }));
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    load().catch((e) => {
      setLoading(false);
      toast.error(friendlyMessagingError(e));
    });
  }, [load]);

  useEffect(() => {
    markRead({ data: { conversation_id: conversationId } })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["unread-chats", user?.id] });
        qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
      })
      .catch(() => {});
  }, [conversationId, markRead, qc, user?.id, messages.length]);

  useEffect(() => {
    if (!user) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`panel-conv-${conversationId}`)
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
                const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 200;
                if (nearBottom)
                  requestAnimationFrame(() =>
                    bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
                  );
              })
              .catch(() => {});
          },
        )
        .subscribe();
    } catch (error) {
      console.warn("[panel-conversation] realtime disabled", error);
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
          attachments,
        },
      });
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      setReplyTo(null);
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
        prev.map((m) => (m.id === editingMsg.id ? { ...m, body, edited_at: new Date().toISOString() } : m)),
      );
      setEditingMsg(null);
    } catch (e) {
      toast.error(friendlyMessagingError(e));
    }
  };

  const handleDelete = async (m: ChatMessage) => {
    try {
      await remove({ data: { message_id: m.id } });
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString() } : x)),
      );
    } catch (e) {
      toast.error(friendlyMessagingError(e));
    }
  };

  const h = header.data;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-3 py-3 pr-12">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-surface ui-transition"
          aria-label="Назад к списку"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {h?.kind === "support" ? (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <Headphones className="h-5 w-5" />
          </div>
        ) : h?.peer_logo_url ? (
          <img
            src={h.peer_logo_url}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand">
            {(h?.peer_name ?? "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{h?.peer_name ?? "Диалог"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {h?.peer_typing
              ? "печатает…"
              : h?.kind === "support"
                ? "Поддержка Kupiks"
                : h?.my_role === "buyer"
                  ? "Продавец"
                  : "Покупатель"}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-surface/40 px-3 py-4">
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium hover:border-brand ui-transition"
            >
              {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Показать ещё
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Сообщений пока нет — напишите первым.
          </p>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              mine={m.sender_id === user?.id}
              onReply={setReplyTo}
              onEdit={setEditingMsg}
              onDelete={(x) => void handleDelete(x)}
              onReport={() => toast.info("Жалобу можно отправить на странице диалога")}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-background">
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
    </>
  );
}
