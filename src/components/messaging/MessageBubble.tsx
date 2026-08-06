// Пузырь сообщения: контекст (товар/заказ), цитата, вложения, статусы, действия.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage } from "@/lib/messaging/types";
import { EDIT_WINDOW_MS } from "@/lib/messaging/types";
import { Check, CheckCheck, Clock, Flag, Pencil, Reply, Trash2 } from "lucide-react";

function money(k: number | null) {
  if (k == null) return "";
  return `${(k / 100).toLocaleString("ru-RU")} ₽`;
}

function time(dt: string) {
  return new Date(dt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function AttachmentGrid({ items, mine }: { items: ChatMessage["attachments"]; mine: boolean }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries: [string, string][] = [];
      for (const a of items) {
        const { data } = await supabase.storage.from("chat-files").createSignedUrl(a.storage_path, 3600);
        if (data?.signedUrl) entries.push([a.id, data.signedUrl]);
      }
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  if (!items.length) return null;
  return (
    <div className={`mt-2 grid gap-1.5 ${items.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {items.map((a) => {
        const url = urls[a.id];
        const isImage = a.mime.startsWith("image/");
        if (isImage) {
          return (
            <a key={a.id} href={url} target="_blank" rel="noreferrer" className="block">
              {url ? (
                <img
                  src={url}
                  alt="Вложение"
                  loading="lazy"
                  className="w-full max-h-64 rounded-xl object-cover border border-black/5"
                />
              ) : (
                <div className="h-32 w-full rounded-xl bg-black/5 animate-pulse" />
              )}
            </a>
          );
        }
        return (
          <a
            key={a.id}
            href={url}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs underline ${
              mine ? "bg-white/15" : "bg-black/5"
            }`}
          >
            Файл · {Math.max(1, Math.round(a.size_bytes / 1024))} КБ
          </a>
        );
      })}
    </div>
  );
}

function ContextCard({ ctx, mine }: { ctx: NonNullable<ChatMessage["context"]>; mine: boolean }) {
  const base = `mb-2 flex items-center gap-2 rounded-xl p-2 ${mine ? "bg-white/15" : "bg-black/5"}`;
  if (ctx.type === "product") {
    return (
      <Link to="/product/$id" params={{ id: ctx.id }} className={base}>
        {ctx.image_url ? (
          <img src={ctx.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" loading="lazy" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-black/10" />
        )}
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium">{ctx.title}</span>
          <span className="block text-[11px] opacity-70">{money(ctx.price_kopecks)}</span>
        </span>
      </Link>
    );
  }
  return (
    <div className={base}>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{ctx.title}</span>
        <span className="block text-[11px] opacity-70">{money(ctx.total_kopecks)}</span>
      </span>
    </div>
  );
}

export function MessageBubble({
  m,
  mine,
  onReply,
  onEdit,
  onDelete,
  onReport,
}: {
  m: ChatMessage;
  mine: boolean;
  onReply: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onReport: (m: ChatMessage) => void;
}) {
  if (m.is_system) {
    return (
      <div className="my-2 flex justify-center">
        <div className="max-w-[85%] rounded-full bg-surface px-4 py-1.5 text-center text-xs text-muted-foreground">
          {m.body}
        </div>
      </div>
    );
  }

  const deleted = !!m.deleted_at;
  const canEdit = mine && !deleted && Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS;

  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[86%] items-end gap-1.5 md:max-w-[70%] ${mine ? "flex-row" : "flex-row-reverse"}`}>
        {/* Действия */}
        {!deleted && (
          <div className="flex shrink-0 flex-col gap-1 opacity-0 transition group-hover:opacity-100 md:flex-row">
            <button
              type="button"
              onClick={() => onReply(m)}
              title="Ответить"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-surface"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(m)}
                title="Изменить"
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-surface"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {mine ? (
              <button
                type="button"
                onClick={() => onDelete(m)}
                title="Удалить"
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-surface"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onReport(m)}
                title="Жалоба"
                className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-surface"
              >
                <Flag className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
            mine ? "bg-brand text-brand-foreground rounded-br-md" : "border bg-white rounded-bl-md"
          }`}
        >
          {m.context && <ContextCard ctx={m.context} mine={mine} />}

          {m.reply_to_id && m.reply_preview && (
            <div
              className={`mb-2 border-l-2 pl-2 text-xs ${
                mine ? "border-white/50 opacity-90" : "border-brand text-muted-foreground"
              }`}
            >
              <div className="font-medium">{m.reply_sender_name}</div>
              <div className="line-clamp-2">{m.reply_preview}</div>
            </div>
          )}

          {deleted ? (
            <p className="italic opacity-70">Сообщение удалено</p>
          ) : (
            m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>
          )}

          <AttachmentGrid items={m.attachments} mine={mine} />

          <div
            className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${
              mine ? "text-white/75" : "text-muted-foreground"
            }`}
          >
            {m.edited_at && <span>изменено</span>}
            <span>{time(m.created_at)}</span>
            {mine &&
              (m.read_at ? (
                <CheckCheck className="h-3.5 w-3.5" />
              ) : m.delivered_at ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Clock className="h-3 w-3" />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
