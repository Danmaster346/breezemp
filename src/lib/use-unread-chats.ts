// Хук счётчика непрочитанных сообщений в чатах (с реалтайм-обновлением)
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useId } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getUnreadChatCount } from "@/lib/chat.functions";
import { toast } from "sonner";

export function useUnreadChats() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchUnread = useServerFn(getUnreadChatCount);
  const channelSuffix = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const q = useQuery({
    queryKey: ["unread-chats", user?.id],
    enabled: !!user,
    queryFn: async () => (await fetchUnread()).count,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!user) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      // У хука несколько потребителей (шапка, сайдбары, mobile nav). Уникальный topic
      // не даёт Realtime переиспользовать уже подписанный канал и ронять кабинет.
      ch = supabase
        .channel(`unread-${user.id}-${channelSuffix}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload) => {
            const row = payload.new as { sender_id: string; body: string | null };
            if (row.sender_id === user.id) return;
            qc.invalidateQueries({ queryKey: ["unread-chats", user.id] });
            qc.invalidateQueries({ queryKey: ["chats", user.id] });
            toast.message("Новое сообщение", {
              description: row.body ? row.body.slice(0, 80) : "Фото",
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "chat_messages" },
          () => qc.invalidateQueries({ queryKey: ["unread-chats", user.id] }),
        )
        .subscribe();
    } catch (error) {
      console.warn("[unread-chats] realtime disabled", error);
    }
    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, [user, qc, channelSuffix]);

  return q.data ?? 0;
}
