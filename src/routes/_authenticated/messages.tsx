// Список чатов пользователя — единая страница «Мои сообщения»
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/use-auth";
import { listChats } from "@/lib/chat.functions";
import { MessageCircle, Search, Store, ShoppingBag, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Мои сообщения — BREEZE" }] }),
  component: MessagesList,
});

type ChatItem = {
  id: string;
  role: "buyer" | "seller";
  other: { id: string; full_name: string };
  product: { id: string; title: string; image_url: string | null } | null;
  order_id: string | null;
  last_message: {
    body: string | null;
    has_image: boolean;
    created_at: string;
    from_me: boolean;
  } | null;
  last_message_at: string;
  unread: number;
};

function fmt(dt: string) {
  const d = new Date(dt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffMs < 2 * day) return "Вчера";
  if (diffMs < 7 * day) {
    return d.toLocaleDateString("ru-RU", { weekday: "short" });
  }
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

type FilterKey = "all" | "buyer" | "seller";

function MessagesList() {
  const { user } = useAuth();
  const fetchChats = useServerFn(listChats);
  const q = useQuery({
    queryKey: ["chats", user?.id],
    enabled: !!user,
    queryFn: () => fetchChats(),
    refetchInterval: 20_000,
  });

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const chats = q.data ?? [];
  const counts = useMemo(() => {
    const totalUnread = chats.reduce((s, c) => s + c.unread, 0);
    return {
      all: chats.length,
      buyer: chats.filter((c) => c.role === "buyer").length,
      seller: chats.filter((c) => c.role === "seller").length,
      totalUnread,
    };
  }, [chats]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return chats.filter((c) => {
      if (filter !== "all" && c.role !== filter) return false;
      if (!term) return true;
      const hay = `${c.other.full_name} ${c.product?.title ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [chats, query, filter]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-4 md:py-8">
        <div className="mb-4 md:mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Мои сообщения</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Переписка с продавцами и покупателями
              {counts.totalUnread > 0 && (
                <> · <span className="text-brand font-medium">{counts.totalUnread} новых</span></>
              )}
            </p>
          </div>
        </div>

        {/* Поиск */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или товару"
            className="w-full h-11 pl-10 pr-10 rounded-full border bg-white text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-full hover:bg-surface"
              aria-label="Очистить"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Фильтры-табы */}
        <div className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1 pb-1">
          {([
            { k: "all", label: "Все", n: counts.all },
            { k: "buyer", label: "Как покупатель", n: counts.buyer },
            { k: "seller", label: "Как продавец", n: counts.seller },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-medium border transition ${
                filter === t.k
                  ? "bg-foreground text-background border-foreground"
                  : "bg-white text-foreground border-border hover:border-foreground/40"
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${filter === t.k ? "opacity-70" : "text-muted-foreground"}`}>
                {t.n}
              </span>
            </button>
          ))}
        </div>

        {q.isLoading ? (
          <ul className="divide-y rounded-2xl border bg-white overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 p-4 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-surface" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 bg-surface rounded" />
                  <div className="h-3 w-2/3 bg-surface rounded" />
                </div>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <EmptyState hasChats={chats.length > 0} hasQuery={!!query} />
        ) : (
          <ul className="divide-y rounded-2xl border bg-white overflow-hidden shadow-sm">
            {filtered.map((c) => (
              <ChatRow key={c.id} c={c} />
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}

function ChatRow({ c }: { c: ChatItem }) {
  const isBuyer = c.role === "buyer";
  const roleLabel = isBuyer ? "Продавец" : "Покупатель";
  const preview = c.last_message
    ? `${c.last_message.from_me ? "Вы: " : ""}${
        c.last_message.body ?? (c.last_message.has_image ? "📷 Фото" : "")
      }`
    : "Нет сообщений";

  return (
    <li>
      <Link
        to="/messages/$chatId"
        params={{ chatId: c.id }}
        className="flex items-center gap-3 p-3 md:p-4 hover:bg-surface active:bg-surface transition"
      >
        {/* Аватар */}
        <div className="relative shrink-0">
          <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-brand-soft text-brand grid place-items-center font-semibold">
            {initials(c.other.full_name)}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white border grid place-items-center">
            {isBuyer ? (
              <Store className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ShoppingBag className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className={`truncate ${c.unread > 0 ? "font-semibold" : "font-medium"}`}>
              {c.other.full_name}
            </div>
            <div className={`text-xs shrink-0 ${c.unread > 0 ? "text-brand font-medium" : "text-muted-foreground"}`}>
              {fmt(c.last_message_at)}
            </div>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {roleLabel}
            {c.product ? ` · ${c.product.title}` : ""}
          </div>
          <div
            className={`mt-0.5 text-sm truncate ${
              c.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"
            }`}
          >
            {preview}
          </div>
        </div>

        {/* Превью товара / бейдж */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {c.product?.image_url && (
            <img
              src={c.product.image_url}
              alt=""
              className="hidden sm:block h-12 w-12 rounded-lg object-cover border"
              loading="lazy"
            />
          )}
          {c.unread > 0 && (
            <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand text-brand-foreground text-xs font-bold grid place-items-center">
              {c.unread > 99 ? "99+" : c.unread}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function EmptyState({ hasChats, hasQuery }: { hasChats: boolean; hasQuery: boolean }) {
  if (hasQuery) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center bg-white">
        <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium">Ничего не найдено</p>
        <p className="text-sm text-muted-foreground mt-1">Попробуйте изменить запрос</p>
      </div>
    );
  }
  if (hasChats) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center bg-white">
        <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Нет чатов в этой категории.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed p-10 md:p-14 text-center bg-white">
      <div className="h-16 w-16 mx-auto rounded-full bg-brand-soft text-brand grid place-items-center mb-4">
        <MessageCircle className="h-8 w-8" />
      </div>
      <p className="text-lg font-semibold">Пока нет сообщений</p>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
        Напишите продавцу с карточки товара или из своего заказа — все переписки появятся здесь.
      </p>
      <Link
        to="/catalog"
        className="inline-flex items-center gap-2 mt-5 h-10 px-5 rounded-full bg-brand text-brand-foreground text-sm font-medium hover:opacity-90 transition"
      >
        Перейти в каталог
      </Link>
    </div>
  );
}
