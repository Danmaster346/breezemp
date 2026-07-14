// Один чат: сообщения + отправка текста и фото
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getChatThread, sendChatMessage } from "@/lib/chat.functions";
import { formatPrice } from "@/lib/format";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, Check, CheckCheck, Image as ImageIcon, Loader2, RotateCw, Send, X } from "lucide-react";

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

function ChatThread() {
  const { chatId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchThread = useServerFn(getChatThread);
  const sendFn = useServerFn(sendChatMessage);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<{ path: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const q = useQuery({
    queryKey: ["chat", chatId],
    enabled: !!user,
    queryFn: () => fetchThread({ data: { chat_id: chatId } }),
  });

  const messages = q.data?.messages ?? [];
  const chat = q.data?.chat;

  // Прокрутка к последнему сообщению
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  // Реалтайм: перезагружаем при новых сообщениях в этом чате
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`chat-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["chat", chatId] });
          qc.invalidateQueries({ queryKey: ["unread-chats", user.id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [chatId, user, qc]);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body && !pending) return;
    if (!user) {
      toast.error("Нужно войти в аккаунт");
      return;
    }
    setSending(true);
    const payload = {
      chat_id: chatId,
      body: body || null,
      image_path: pending?.path ?? null,
    };
    console.log("[chat.send] client → server", payload);
    try {
      const res = await sendFn({ data: payload });
      console.log("[chat.send] server response", res);
      setText("");
      setPending(null);
      qc.invalidateQueries({ queryKey: ["chat", chatId] });
      qc.invalidateQueries({ queryKey: ["chats", user.id] });
    } catch (err) {
      const e = err as Error & { cause?: unknown };
      console.error("[chat.send] failed", {
        message: e.message,
        name: e.name,
        cause: e.cause,
        stack: e.stack,
      });
      toast.error(e.message || "Не удалось отправить сообщение");
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
            {q.isLoading ? (
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
                      className={`text-[10px] mt-1 text-right ${
                        m.from_me ? "text-white/70" : "text-muted-foreground"
                      }`}
                    >
                      {fmtTime(m.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
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
