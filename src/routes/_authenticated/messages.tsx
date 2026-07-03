// Список чатов: покупателя и продавца в одном месте
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/use-auth";
import { listChats } from "@/lib/chat.functions";
import { MessageCircle, Store, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Сообщения — BREEZE" }] }),
  component: MessagesList,
});

function fmt(dt: string) {
  const d = new Date(dt);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function MessagesList() {
  const { user } = useAuth();
  const fetchChats = useServerFn(listChats);
  const q = useQuery({
    queryKey: ["chats", user?.id],
    enabled: !!user,
    queryFn: () => fetchChats(),
    refetchInterval: 30_000,
  });

  const chats = q.data ?? [];

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">Сообщения</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Переписка с продавцами и покупателями по товарам и заказам.
        </p>

        {q.isLoading ? (
          <div className="text-muted-foreground">Загрузка…</div>
        ) : chats.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center">
            <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Пока нет ни одного чата.</p>
          </div>
        ) : (
          <ul className="divide-y rounded-2xl border bg-white overflow-hidden">
            {chats.map((c) => (
              <li key={c.id}>
                <Link
                  to="/messages/$chatId"
                  params={{ chatId: c.id }}
                  className="flex items-center gap-3 p-4 hover:bg-surface transition"
                >
                  <div className="h-12 w-12 rounded-full bg-brand-soft text-brand grid place-items-center shrink-0">
                    {c.role === "buyer" ? <Store className="h-5 w-5" /> : <ShoppingBag className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-semibold truncate">{c.other.full_name}</div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {fmt(c.last_message_at)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.role === "buyer" ? "Продавец" : "Покупатель"}
                      {c.product ? ` · ${c.product.title}` : ""}
                    </div>
                    <div className="mt-1 text-sm text-foreground/80 truncate">
                      {c.last_message
                        ? `${c.last_message.from_me ? "Вы: " : ""}${
                            c.last_message.body ??
                            (c.last_message.has_image ? "📷 Фото" : "")
                          }`
                        : <span className="text-muted-foreground">Нет сообщений</span>}
                    </div>
                  </div>
                  {c.unread > 0 && (
                    <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand text-brand-foreground text-xs font-bold grid place-items-center">
                      {c.unread}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
