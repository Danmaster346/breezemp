// Мягкий баннер запроса разрешения на браузерные уведомления (без резкого попапа).
import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";

const DISMISS_KEY = "kupiks:push-optin-dismissed";

export function PushOptInBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;
    const t = window.setTimeout(() => setShow(true), 1500);
    return () => window.clearTimeout(t);
  }, [user?.id]);

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* приватный режим */
    }
  };

  const enable = async () => {
    try {
      const res = await Notification.requestPermission();
      if (res === "granted") toast.success("🔔 Уведомления включены");
      else toast("Уведомления не включены. Можно разрешить их в настройках браузера.");
    } catch {
      toast.error("Браузер не поддерживает уведомления");
    }
    dismiss();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+72px)] z-50 md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px]">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Bell className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">🔔 Включите уведомления</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Чтобы не пропустить статусы заказов и сообщения от продавцов.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={enable}
                className="h-9 rounded-full bg-brand px-4 text-xs font-bold text-brand-foreground hover:opacity-90 ui-transition"
              >
                Включить
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="h-9 rounded-full border border-border px-4 text-xs font-semibold text-foreground/80 hover:bg-surface ui-transition"
              >
                Не сейчас
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Закрыть"
            className="rounded-full p-1 text-muted-foreground hover:bg-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
