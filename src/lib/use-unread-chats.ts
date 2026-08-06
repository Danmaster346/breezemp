// Хук счётчика непрочитанных сообщений (новая система диалогов)
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useId } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { getUnreadMessageCount } from "@/lib/messaging/messaging.functions";
import { toast } from "sonner";

export function useUnreadChats() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchUnread = useServerFn(getUnreadMessageCount);
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
      // Уникальный topic: хук используют шапка, сайдбары и мобильная навигация одновременно.
      ch = supabase
        .channel(`unread-msg-${user.id}-${channelSuffix}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const row = payload.new as { sender_id: string; body: string | null };
            if (row.sender_id === user.id) return;
            qc.invalidateQueries({ queryKey: ["unread-chats", user.id] });
            qc.invalidateQueries({ queryKey: ["conversations", user.id] });
            toast.message("Новое сообщение", {
              description: row.body ? row.body.slice(0, 80) : "Вложение",
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "conversation_participants" },
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
