// Один чат: сообщения + отправка текста и фото
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { useServerFn } from "@tanstack/react-start";
import { useEffect, useId, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getChatThread, markChatDelivered, sendChatMessage } from "@/lib/chat.functions";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, Check, CheckCheck, ChevronUp, Image as ImageIcon, Loader2, RotateCw, Send, X } from "lucide-react";

type OutboxItem = {
  local_id: string;
  body: string | null;
  image_path: string | null;
  image_url: string | null;
  status: "sending" | "sent" | "error";
  error?: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/messages/$chatId")({
  head: () => ({ meta: [{ title: "Чат — BREEZE" }] }),
  component: ChatThread,
});

function fmtTime(dt: string) {
  return new Date(dt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

// Понятные сообщения об ошибках вместо сырых 500/технических текстов
function friendlyError(err: unknown): string {
  const raw = (err as Error)?.message ?? String(err ?? "");
  const s = raw.toLowerCase();
  if (!navigator.onLine) return "Нет соединения. Сообщение сохранено — отправим при подключении.";
  if (s.includes("failed to fetch") || s.includes("networkerror") || s.includes("network request"))
    return "Не удалось связаться с сервером. Проверьте интернет.";
  if (s.includes("unauthorized") || s.includes("401") || s.includes("нет доступа"))
    return "Сессия истекла. Войдите в аккаунт заново.";
  if (s.includes("нет доступа к чату")) return "Нет доступа к этому чату.";
  if (s.includes("чат не найден")) return "Чат не найден.";
  if (s.includes("пустое сообщение")) return "Сообщение пустое.";
  if (s.includes("500") || s.includes("http error") || s.includes("internal"))
    return "Сервер временно недоступен. Попробуйте ещё раз.";
  if (s.includes("timeout") || s.includes("aborted"))
    return "Превышено время ожидания. Попробуйте ещё раз.";
  return raw || "Не удалось отправить. Попробуйте ещё раз.";
}

const outboxKey = (chatId: string) => `kupiks.chat.outbox.${chatId}`;


function ChatThread() {
  const { chatId } = Route.useParams();
  const realtimeChannelSuffix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchThread = useServerFn(getChatThread);
  const sendFn = useServerFn(sendChatMessage);
  const markDeliveredFn = useServerFn(markChatDelivered);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<{ path: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);

  // Пагинация: держим сообщения в локальном стейте, подгружаем страницами по 30
  type ChatMeta = NonNullable<Awaited<ReturnType<typeof getChatThread>>["chat"]>;
  type ChatMessage = Awaited<ReturnType<typeof getChatThread>>["messages"][number];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chat, setChat] = useState<ChatMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const oldestCursor = messages[0]?.created_at ?? null;
  const didInitialScroll = useRef(false);

  // Начальная загрузка последней страницы
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    didInitialScroll.current = false;
    fetchThread({ data: { chat_id: chatId } })
      .then((res) => {
        if (cancelled) return;
        setChat(res.chat);
        setMessages(res.messages);
        setHasMore(res.hasMore);
      })
      .catch((err) => {
        if (!cancelled) toast.error(friendlyError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chatId, user, fetchThread]);

  const loadOlder = async () => {
    if (loadingMore || !hasMore || !oldestCursor) return;
    setLoadingMore(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    try {
      const res = await fetchThread({ data: { chat_id: chatId, before: oldestCursor } });
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const older = res.messages.filter((m) => !existing.has(m.id));
        return [...older, ...prev];
      });
      setHasMore(res.hasMore);
      // Сохраняем позицию скролла — компенсируем прирост высоты
      requestAnimationFrame(() => {
        const now = scrollRef.current;
        if (now) now.scrollTop = prevTop + (now.scrollHeight - prevHeight);
      });
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoadingMore(false);
    }
  };

  // Прокрутка вниз при первой загрузке и при появлении новых сообщений/outbox
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!didInitialScroll.current && messages.length > 0) {
      el.scrollTop = el.scrollHeight;
      didInitialScroll.current = true;
      return;
    }
    // Автоскролл вниз, если пользователь и так у низа
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages.length, outbox.length]);

  // Реалтайм: подхватываем новые сообщения и обновления статусов (доставлено/прочитано)
  useEffect(() => {
    if (!user) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`chat-${chatId}-${realtimeChannelSuffix}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
          (payload) => {
            const row = payload.new as { sender_id?: string };
            // Если пришло чужое сообщение — мгновенно подтверждаем доставку на сервере,
            // чтобы у отправителя тут же появилась вторая галочка через UPDATE-событие.
            if (row?.sender_id && row.sender_id !== user.id) {
              markDeliveredFn({ data: { chat_id: chatId } }).catch(() => {});
            }
            fetchThread({ data: { chat_id: chatId, limit: 20 } })
              .then((res) => {
                setMessages((prev) => {
                  const existing = new Set(prev.map((m) => m.id));
                  const fresh = res.messages.filter((m) => !existing.has(m.id));
                  return fresh.length ? [...prev, ...fresh] : prev;
                });
              })
              .catch(() => {});
            qc.invalidateQueries({ queryKey: ["unread-chats", user.id] });
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
          (payload) => {
            const row = payload.new as {
              id: string;
              delivered_at: string | null;
              read_at: string | null;
            };
            setMessages((prev) =>
              prev.map((m) =>
                m.id === row.id
                  ? { ...m, delivered_at: row.delivered_at, read_at: row.read_at }
                  : m,
              ),
            );
          },
        )
        .subscribe();
    } catch (error) {
      console.warn("[chat-thread] realtime subscribe failed", error);
    }
    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, [chatId, user, qc, fetchThread, markDeliveredFn, realtimeChannelSuffix]);


  // Восстановление outbox из localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(outboxKey(chatId));
      if (raw) {
        const parsed = JSON.parse(raw) as OutboxItem[];
        setOutbox(parsed.map((o) => (o.status === "sending" ? { ...o, status: "error", error: "Не отправлено" } : o)));
      }
    } catch {
      // ignore
    }
  }, [chatId]);

  // Сохраняем outbox в localStorage (только то, что не «sent»)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const toSave = outbox.filter((o) => o.status !== "sent");
    try {
      if (toSave.length) window.localStorage.setItem(outboxKey(chatId), JSON.stringify(toSave));
      else window.localStorage.removeItem(outboxKey(chatId));
    } catch {
      // ignore
    }
  }, [outbox, chatId]);


  // Автоповтор ошибочных сообщений при возвращении сети
  const outboxRef = useRef<OutboxItem[]>([]);
  useEffect(() => {
    outboxRef.current = outbox;
  }, [outbox]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      const pending = outboxRef.current.filter((o) => o.status === "error");
      if (pending.length) {
        toast.info(`Соединение восстановлено — повторяем отправку (${pending.length})`);
        pending.forEach((o) => void trySend(o));
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Фото больше 5 МБ");
    setUploading(true);
    console.log("[chat.upload] start", { name: file.name, size: file.size, type: file.type });
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage
        .from("chat-photos")
        .upload(path, file, { contentType: file.type });
      if (up.error) {
        console.error("[chat.upload] upload failed", up.error);
        throw up.error;
      }
      const signed = await supabase.storage
        .from("chat-photos")
        .createSignedUrl(path, 3600);
      if (signed.error || !signed.data) {
        console.error("[chat.upload] sign url failed", signed.error);
        throw signed.error ?? new Error("Не удалось получить ссылку");
      }
      setPending({ path, url: signed.data.signedUrl });
      console.log("[chat.upload] ok", { path });
    } catch (err) {
      console.error("[chat.upload] error", err);
      toast.error(`Загрузка фото: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const trySend = async (item: OutboxItem) => {
    setOutbox((prev) => prev.map((o) => (o.local_id === item.local_id ? { ...o, status: "sending", error: undefined } : o)));
    const payload = { chat_id: chatId, body: item.body, image_path: item.image_path };
    console.log("[chat.send] client → server", { local_id: item.local_id, ...payload });
    try {
      const res = await sendFn({ data: payload });
      console.log("[chat.send] server response", res);
      setOutbox((prev) => prev.map((o) => (o.local_id === item.local_id ? { ...o, status: "sent" } : o)));
      qc.invalidateQueries({ queryKey: ["chats", user?.id] });
      if (user) qc.invalidateQueries({ queryKey: ["chats", user.id] });
      // Убираем «отправлено» из outbox после того, как оно точно есть в q.data
      setTimeout(() => {
        setOutbox((prev) => prev.filter((o) => o.local_id !== item.local_id));
      }, 1500);
    } catch (err) {
      const e = err as Error & { cause?: unknown };
      console.error("[chat.send] failed", { message: e.message, name: e.name, cause: e.cause, stack: e.stack });
      const friendly = friendlyError(err);
      setOutbox((prev) => prev.map((o) => (o.local_id === item.local_id ? { ...o, status: "error", error: friendly } : o)));
      toast.error(friendly, { description: "Сообщение сохранено — нажмите «Повторить»." });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body && !pending) return;
    if (!user) {
      toast.error("Нужно войти в аккаунт");
      return;
    }
    const item: OutboxItem = {
      local_id: crypto.randomUUID(),
      body: body || null,
      image_path: pending?.path ?? null,
      image_url: pending?.url ?? null,
      status: "sending",
      created_at: new Date().toISOString(),
    };
    setOutbox((prev) => [...prev, item]);
    setText("");
    setPending(null);
    setSending(true);
    try {
      await trySend(item);
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-0 md:px-4 py-0 md:py-6">
        <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-14rem)] rounded-none md:rounded-2xl border-0 md:border bg-white overflow-hidden">
          {/* Шапка чата */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-white sticky top-0">
            <Link
              to="/messages"
              className="p-1.5 rounded-full hover:bg-surface"
              aria-label="Назад"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">
                {chat?.other.full_name ?? "Чат"}
              </div>
              <div className="text-xs text-muted-foreground">
                {chat?.role === "buyer" ? "Продавец" : "Покупатель"}
              </div>
            </div>
            {chat?.product && (
              <Link
                to="/product/$id"
                params={{ id: chat.product.id }}
                className="hidden sm:flex items-center gap-2 max-w-xs rounded-xl border px-2 py-1.5 hover:bg-surface"
              >
                <div className="h-9 w-9 rounded-lg bg-surface overflow-hidden shrink-0">
                  {chat.product.image_url && (
                    <img src={chat.product.image_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs truncate">{chat.product.title}</div>
                  <div className="text-xs font-semibold">{formatPrice(chat.product.price_kopecks)}</div>
                </div>
              </Link>
            )}
          </div>

          {/* Лента */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-surface/40">
            {hasMore && !loading && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  onClick={loadOlder}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs text-foreground/80 hover:bg-surface disabled:opacity-60"
                >
                  {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronUp className="h-3.5 w-3.5" />}
                  Загрузить ещё
                </button>
              </div>
            )}
            {loading ? (
              <div className="text-center text-muted-foreground text-sm">Загрузка…</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-10">
                Напишите первое сообщение — {chat?.other.full_name ?? "собеседник"} получит его сразу.
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.from_me ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      m.from_me
                        ? "bg-brand text-brand-foreground rounded-br-md"
                        : "bg-white text-foreground rounded-bl-md border"
                    }`}
                  >
                    {m.image_url && (
                      <a href={m.image_url} target="_blank" rel="noreferrer">
                        <img
                          src={m.image_url}
                          alt=""
                          className="rounded-lg mb-1 max-h-64 object-cover"
                        />
                      </a>
                    )}
                    {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                    <div
                      className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${
                        m.from_me ? "text-white/70" : "text-muted-foreground"
                      }`}
                    >
                      <span>{fmtTime(m.created_at)}</span>
                      {m.from_me && (
                        m.read_at ? (
                          <CheckCheck className="h-3.5 w-3.5 text-sky-200" aria-label="Прочитано" />
                        ) : m.delivered_at ? (
                          <CheckCheck className="h-3.5 w-3.5" aria-label="Доставлено" />
                        ) : (
                          <Check className="h-3.5 w-3.5" aria-label="Отправлено" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {outbox.map((o) => (
              <div key={o.local_id} className="flex justify-end">
                <div
                  className={`max-w-[80%] rounded-2xl rounded-br-md px-3 py-2 text-sm shadow-sm ${
                    o.status === "error"
                      ? "bg-destructive/10 text-foreground border border-destructive/40"
                      : "bg-brand text-brand-foreground opacity-90"
                  }`}
                >
                  {o.image_url && (
                    <img src={o.image_url} alt="" className="rounded-lg mb-1 max-h-64 object-cover" />
                  )}
                  {o.body && <div className="whitespace-pre-wrap break-words">{o.body}</div>}
                  <div className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${o.status === "error" ? "text-destructive" : "text-white/80"}`}>
                    {fmtTime(o.created_at)}
                    {o.status === "sending" && (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>отправляется</span>
                      </>
                    )}
                    {o.status === "sent" && (
                      <>
                        <CheckCheck className="h-3 w-3" />
                        <span>отправлено</span>
                      </>
                    )}
                    {o.status === "error" && (
                      <>
                        <AlertCircle className="h-3 w-3" />
                        <span className="truncate max-w-[140px]" title={o.error}>{o.error ?? "ошибка"}</span>
                        <button
                          type="button"
                          onClick={() => void trySend(o)}
                          className="ml-1 inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-white hover:bg-destructive/90"
                        >
                          <RotateCw className="h-3 w-3" /> Повторить
                        </button>
                        <button
                          type="button"
                          onClick={() => setOutbox((prev) => prev.filter((x) => x.local_id !== o.local_id))}
                          className="ml-1 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-foreground/70 hover:bg-muted/80"
                          aria-label="Удалить"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Композер */}
          <form
            onSubmit={submit}
            className="border-t bg-white p-3 flex items-end gap-2"
          >
            {pending && (
              <div className="relative shrink-0">
                <img src={pending.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-black/70 text-white grid place-items-center"
                  aria-label="Убрать фото"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <label className="shrink-0 h-10 w-10 rounded-full grid place-items-center hover:bg-surface cursor-pointer text-foreground/70">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
              <input type="file" accept="image/*" hidden onChange={pickPhoto} />
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit(e as unknown as React.FormEvent);
                }
              }}
              rows={1}
              placeholder="Напишите сообщение…"
              className="flex-1 resize-none max-h-32 px-4 py-2.5 rounded-2xl bg-surface text-sm outline-none focus:ring-2 focus:ring-brand/30"
            />
            <button
              type="submit"
              disabled={sending || (!text.trim() && !pending)}
              className="shrink-0 h-10 w-10 rounded-full bg-brand text-brand-foreground grid place-items-center disabled:opacity-50 hover:bg-brand/90"
              aria-label="Отправить"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
