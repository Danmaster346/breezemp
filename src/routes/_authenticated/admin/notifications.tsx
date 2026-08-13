// Рассылки уведомлений
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listAdminNotifications,
  searchNotificationRecipients,
  sendAdminNotification,
} from "@/lib/admin/notifications.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: NotificationsPage,
});

const TARGET_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "buyers", label: "Покупатели" },
  { value: "sellers", label: "Продавцы" },
  { value: "custom", label: "Конкретный пользователь" },
] as const;

const TYPE_OPTIONS = [
  { value: "info", label: "Информация" },
  { value: "promo", label: "Акция" },
  { value: "important", label: "Важное" },
  { value: "warning", label: "Предупреждение" },
] as const;

const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label]));
const TYPE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  promo: "default",
  important: "destructive",
  warning: "outline",
};

const TARGET_LABELS: Record<string, string> = {
  all: "Все",
  buyers: "Покупатели",
  sellers: "Продавцы",
};

function NotificationsPage() {
  const list = useServerFn(listAdminNotifications);
  const search = useServerFn(searchNotificationRecipients);
  const send = useServerFn(sendAdminNotification);
  const qc = useQueryClient();

  const [targetMode, setTargetMode] = useState<(typeof TARGET_OPTIONS)[number]["value"]>("all");
  const [customQuery, setCustomQuery] = useState("");
  const [customUser, setCustomUser] = useState<{ id: string; full_name: string | null; email: string | null } | null>(null);
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]["value"]>("info");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data: searchData } = useQuery({
    queryKey: ["notif-recipients", customQuery],
    queryFn: () => search({ data: { q: customQuery } }),
    enabled: targetMode === "custom" && customQuery.trim().length > 0,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-notifications", page],
    queryFn: () => list({ data: { page, pageSize: 20 } }),
  });

  useEffect(() => {
    if (targetMode !== "custom") setCustomUser(null);
  }, [targetMode]);

  const sendM = useMutation({
    mutationFn: send,
    onSuccess: (res) => {
      const target = targetMode === "custom" ? (customUser?.full_name || customUser?.email || "пользователь") : TARGET_LABELS[targetMode];
      toast.success(`Рассылка отправлена: ${target}, охват ${res.recipients_count}`);
      qc.invalidateQueries({ queryKey: ["admin-notifications"] });
      setConfirmOpen(false);
      setTitle("");
      setBody("");
      setLink("");
      setCustomUser(null);
      setCustomQuery("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.rows ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  const target = targetMode === "custom" ? customUser?.id ?? "" : targetMode;
  const canSend = title.trim().length > 0 && body.trim().length > 0 && (targetMode !== "custom" || !!customUser);

  const doSend = () => {
    if (!canSend) return;
    sendM.mutate({ data: { title: title.trim(), body: body.trim(), link: link.trim() || undefined, target, type } });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Рассылки</h1>
        <p className="text-foreground/60 text-sm mt-1">Отправка уведомлений пользователям</p>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 p-4 space-y-4">
        <div>
          <div className="text-sm font-semibold mb-2">Кому</div>
          <div className="flex flex-wrap gap-2">
            {TARGET_OPTIONS.map((o) => (
              <Button
                key={o.value}
                type="button"
                size="sm"
                variant={targetMode === o.value ? "default" : "outline"}
                onClick={() => setTargetMode(o.value)}
              >
                {o.label}
              </Button>
            ))}
          </div>
          {targetMode === "custom" && (
            <div className="relative mt-2 max-w-sm">
              <Input
                placeholder="Поиск по имени или email"
                value={customUser ? (customUser.full_name || customUser.email || "") : customQuery}
                onChange={(e) => { setCustomUser(null); setCustomQuery(e.target.value); }}
              />
              {!customUser && customQuery.trim().length > 0 && (searchData?.length ?? 0) > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-white shadow-lg max-h-56 overflow-y-auto">
                  {searchData!.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface"
                      onClick={() => { setCustomUser(u); setCustomQuery(""); }}
                    >
                      <div className="font-medium">{u.full_name || "—"}</div>
                      <div className="text-xs text-foreground/60">{u.email ?? "—"}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">Тип</div>
          <select value={type} onChange={(e) => setType(e.target.value as never)} className="rounded-md border border-border px-3 h-10 text-sm bg-white">
            {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <div className="text-sm font-semibold">Заголовок</div>
            <div className="text-xs text-foreground/50">{title.length}/100</div>
          </div>
          <Input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок уведомления" />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <div className="text-sm font-semibold">Текст</div>
            <div className="text-xs text-foreground/50">{body.length}/500</div>
          </div>
          <Textarea value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} placeholder="Текст сообщения" rows={4} />
        </div>

        <div>
          <div className="text-sm font-semibold mb-1">Ссылка (опционально)</div>
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/catalog или https://..." />
        </div>

        <div className="flex justify-end">
          <Button disabled={!canSend} onClick={() => setConfirmOpen(true)}>
            <Send className="h-4 w-4 mr-1" />Отправить
          </Button>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-border/60 overflow-hidden">
        <div className="p-3 md:p-4 font-semibold border-b border-border/60">История рассылок</div>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-surface animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-foreground/60">Рассылок пока не было</div>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((n) => (
              <div key={n.id} className="p-3 md:p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{n.title}</div>
                  <div className="text-xs text-foreground/60 truncate">
                    {new Date(n.sent_at).toLocaleString("ru-RU")} · {TARGET_LABELS[n.target] ?? "Пользователь"} · охват {n.recipients_count}
                  </div>
                </div>
                <Badge variant={TYPE_VARIANTS[n.type] ?? "secondary"} className="text-[10px]">
                  {TYPE_LABELS[n.type] ?? n.type}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {data && data.total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Назад</Button>
          <div className="px-3 py-2 text-sm">Стр. {page} из {totalPages}</div>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Вперёд</Button>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отправить рассылку?</DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-1">
            <div><span className="text-foreground/50">Кому:</span> {targetMode === "custom" ? (customUser?.full_name || customUser?.email) : TARGET_LABELS[targetMode]}</div>
            <div><span className="text-foreground/50">Тип:</span> {TYPE_LABELS[type]}</div>
            <div><span className="text-foreground/50">Заголовок:</span> {title}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Отмена</Button>
            <Button disabled={sendM.isPending} onClick={doSend}>Отправить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
