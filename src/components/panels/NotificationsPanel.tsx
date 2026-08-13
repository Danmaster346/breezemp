// Панель уведомлений (колокольчик в шапке): список из user_notifications.
import { Link } from "@tanstack/react-router";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { usePanels } from "@/lib/panels-store";
import { useAuth } from "@/lib/use-auth";
import {
  notificationEmoji,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/use-notifications";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function NotificationsPanel() {
  const { user } = useAuth();
  const open = usePanels((s) => s.notificationsOpen);
  const close = usePanels((s) => s.closeNotifications);
  const q = useNotifications(open);
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAll, isPending: markingAll } = useMarkAllNotificationsRead();

  const items = q.data?.items ?? [];
  const unread = q.data?.unread ?? 0;

  return (
    <Sheet open={open && !!user} onOpenChange={(v) => (v ? null : close())}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        aria-describedby={undefined}
      >
        <div className="border-b border-border px-4 pb-3 pt-5">
          <div className="flex items-center gap-2 pr-8">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Bell className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold tracking-tight">Уведомления</h2>
            {unread > 0 && (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-brand-foreground">
                {unread}
              </span>
            )}
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markAll()}
              disabled={markingAll}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-surface ui-transition disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Отметить все прочитанными
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {q.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-strong/60" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <BellOff className="h-9 w-9 text-muted-foreground" />
              <p className="font-semibold">Уведомлений пока нет</p>
              <p className="text-sm text-muted-foreground">
                Здесь появятся статусы заказов, сообщения и начисления.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((n) => {
                const isUnread = !n.read_at;
                const inner = (
                  <div
                    className={`flex gap-3 rounded-2xl border p-3 text-left ui-transition ${
                      isUnread
                        ? "border-brand/30 bg-brand-soft/40"
                        : "border-border bg-card hover:bg-surface"
                    }`}
                  >
                    <span className="text-xl leading-none">{notificationEmoji(n.type, n.title)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold">{n.title}</p>
                        {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                      </div>
                      <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">{n.body}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                );
                const onOpen = () => {
                  if (isUnread) markRead(n.id);
                };
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        to={n.link as never}
                        onClick={() => {
                          onOpen();
                          close();
                        }}
                        className="block"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button type="button" onClick={onOpen} className="block w-full">
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
