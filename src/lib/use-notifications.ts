// Хук in-app уведомлений: список, счётчик непрочитанных, realtime и push-разрешение.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useId } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/notifications.functions";

export const NOTIFICATIONS_KEY = ["notifications"] as const;

/** Эмодзи по типу уведомления */
export function notificationEmoji(type: string, title = ""): string {
  const t = `${type} ${title}`.toLowerCase();
  if (t.includes("order") || t.includes("заказ")) return "📦";
  if (t.includes("message") || t.includes("сообщ")) return "💬";
  if (t.includes("review") || t.includes("отзыв")) return "⭐";
  if (t.includes("payout") || t.includes("balance") || t.includes("средств")) return "💰";
  if (t.includes("moderat") || t.includes("одобрен") || t.includes("approved")) return "✅";
  if (t.includes("warn") || t.includes("отклон") || t.includes("error")) return "⚠️";
  return "🔔";
}

export function useNotifications(enabled = true) {
  const { user } = useAuth();
  const load = useServerFn(listNotifications);
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, user?.id],
    enabled: enabled && !!user,
    queryFn: () => load(),
    staleTime: 30_000,
  });
}

/** Счётчик непрочитанных + realtime-подписка на новые уведомления */
export function useUnreadNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useNotifications(true);
  const suffix = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  useEffect(() => {
    if (!user) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(`user-notifications-${user.id}-${suffix}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, user.id] });
            if (payload.eventType !== "INSERT") return;
            const row = payload.new as AppNotification;
            toast(`${notificationEmoji(row.type, row.title)} ${row.title}`, {
              description: row.body,
            });
            showBrowserNotification(row.title, row.body);
          },
        )
        .subscribe();
    } catch (error) {
      console.warn("[notifications] realtime disabled", error);
    }
    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, [user?.id, qc, suffix]);

  return q.data?.unread ?? 0;
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fn = useServerFn(markNotificationRead);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, user?.id] }),
  });
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fn = useServerFn(markAllNotificationsRead);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, user?.id] });
      toast.success("Все уведомления прочитаны");
    },
  });
}

/** Показ браузерного уведомления, если разрешение уже выдано */
export function showBrowserNotification(title: string, body?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icons/icon-192.png" });
  } catch {
    /* некоторые браузеры требуют service worker — тихо игнорируем */
  }
}
