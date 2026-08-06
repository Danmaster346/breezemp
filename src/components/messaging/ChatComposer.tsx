// Композер чата: текст, вложения (до 5), цитата, быстрые ответы, «печатает…».
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { setTyping } from "@/lib/messaging/messaging.functions";
import type { ChatMessage } from "@/lib/messaging/types";
import { Loader2, Paperclip, Send, X, Zap } from "lucide-react";

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

export type PendingAttachment = {
  storage_path: string;
  mime: string;
  size_bytes: number;
};

type LocalFile = {
  key: string;
  file: File;
  previewUrl: string | null;
  uploading: boolean;
  uploaded: PendingAttachment | null;
};

export function ChatComposer({
  conversationId,
  replyTo,
  onCancelReply,
  editing,
  onCancelEdit,
  quickReplies,
  onSend,
  onSaveEdit,
}: {
  conversationId: string;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
  editing: ChatMessage | null;
  onCancelEdit: () => void;
  quickReplies: { id: string; text: string }[];
  onSend: (payload: { body: string; attachments: PendingAttachment[] }) => Promise<void>;
  onSaveEdit: (body: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [sending, setSending] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingSentAt = useRef(0);
  const pingTyping = useServerFn(setTyping);

  useEffect(() => {
    if (editing) setText(editing.body ?? "");
  }, [editing]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId, replyTo, editing]);

  useEffect(() => () => files.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl)), [files]);

  const handleTyping = () => {
    const now = Date.now();
    if (now - typingSentAt.current < 3000) return;
    typingSentAt.current = now;
    pingTyping({ data: { conversation_id: conversationId } }).catch(() => {});
  };

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const incoming = Array.from(list);
    if (files.length + incoming.length > MAX_FILES) {
      toast.error(`Можно прикрепить не более ${MAX_FILES} файлов`);
      return;
    }
    for (const file of incoming) {
      if (!ALLOWED.includes(file.type)) {
        toast.error(`${file.name}: поддерживаются JPG, PNG, WEBP, GIF и PDF`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: файл больше 10 МБ`);
        continue;
      }
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      setFiles((prev) => [...prev, { key, file, previewUrl, uploading: true, uploaded: null }]);

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("chat-files").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) {
        toast.error(`Не удалось загрузить ${file.name}`);
        setFiles((prev) => prev.filter((f) => f.key !== key));
        continue;
      }
      setFiles((prev) =>
        prev.map((f) =>
          f.key === key
            ? {
                ...f,
                uploading: false,
                uploaded: { storage_path: path, mime: file.type, size_bytes: file.size },
              }
            : f,
        ),
      );
    }
  };

  const removeFile = (key: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.key === key);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.key !== key);
    });
  };

  const submit = async () => {
    const body = text.trim();
    if (editing) {
      if (!body) return;
      setSending(true);
      try {
        await onSaveEdit(body);
        setText("");
        onCancelEdit();
      } finally {
        setSending(false);
      }
      return;
    }
    const attachments = files.filter((f) => f.uploaded).map((f) => f.uploaded!);
    if (!body && !attachments.length) return;
    if (files.some((f) => f.uploading)) {
      toast.message("Дождитесь загрузки вложений");
      return;
    }
    setSending(true);
    try {
      await onSend({ body, attachments });
      setText("");
      setFiles([]);
      onCancelReply();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t bg-white">
      {replyTo && !editing && (
        <div className="flex items-center gap-2 border-b bg-surface px-3 py-2 text-xs">
          <div className="min-w-0 flex-1 border-l-2 border-brand pl-2">
            <div className="font-medium">Ответ · {replyTo.sender_name}</div>
            <div className="truncate text-muted-foreground">{replyTo.body ?? "Вложение"}</div>
          </div>
          <button type="button" onClick={onCancelReply} aria-label="Отменить ответ">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {editing && (
        <div className="flex items-center gap-2 border-b bg-amber-50 px-3 py-2 text-xs">
          <span className="flex-1 font-medium text-amber-800">Редактирование сообщения</span>
          <button
            type="button"
            onClick={() => {
              setText("");
              onCancelEdit();
            }}
            aria-label="Отменить редактирование"
          >
            <X className="h-4 w-4 text-amber-800" />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b px-3 py-2">
          {files.map((f) => (
            <div key={f.key} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-surface">
              {f.previewUrl ? (
                <img src={f.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center px-1 text-[10px] text-muted-foreground">
                  PDF
                </div>
              )}
              {f.uploading && (
                <div className="absolute inset-0 grid place-items-center bg-black/40">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(f.key)}
                className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
                aria-label="Удалить файл"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <span className="self-center text-xs text-muted-foreground">
            {files.length}/{MAX_FILES}
          </span>
        </div>
      )}

      {showQuick && quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b bg-surface px-3 py-2">
          {quickReplies.map((qr) => (
            <button
              key={qr.id}
              type="button"
              onClick={() => {
                setText((prev) => (prev ? `${prev} ${qr.text}` : qr.text));
                setShowQuick(false);
                inputRef.current?.focus();
              }}
              className="rounded-full border bg-white px-3 py-1.5 text-xs hover:border-brand"
            >
              {qr.text.length > 48 ? `${qr.text.slice(0, 48)}…` : qr.text}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-2.5">
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {!editing && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface"
            aria-label="Прикрепить файл"
          >
            <Paperclip className="h-5 w-5" />
          </button>
        )}
        {quickReplies.length > 0 && !editing && (
          <button
            type="button"
            onClick={() => setShowQuick((v) => !v)}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-surface ${
              showQuick ? "text-brand" : "text-muted-foreground"
            }`}
            aria-label="Быстрые ответы"
          >
            <Zap className="h-5 w-5" />
          </button>
        )}
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Напишите сообщение…"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground transition hover:opacity-90 disabled:opacity-50"
          aria-label="Отправить"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
