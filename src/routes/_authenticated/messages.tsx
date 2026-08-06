// Список диалогов: поиск, фильтры, закрепление, архив, обращение в поддержку.
import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/use-auth";
import {
  listConversations,
  openConversation,
  updateConversationFlags,
} from "@/lib/messaging/messaging.functions";
import type { ConversationSummary } from "@/lib/messaging/types";
import {
  Archive,
  ArchiveRestore,
  BellOff,
  Headphones,
  MessageCircle,
  Pin,
  PinOff,
  Search,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Сообщения — Kupiks" },
      { name: "description", content: "Диалоги с продавцами, покупателями и поддержкой Kupiks." },
    ],
  }),
  component: MessagesList,
});

type FilterKey = "all" | "unread" | "buyer" | "seller" | "support" | "archived";

function fmt(dt: string) {
  const d = new Date(dt);
  const now = new Date();
  const day = 86400000;
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (now.getTime() - d.getTime() < 2 * day) return "Вчера";
  if (now.getTime() - d.getTime() < 7 * day) return d.toLocaleDateString("ru-RU", { weekday: "short" });
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function MessagesList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchList = useServerFn(listConversations);
  const open = useServerFn(openConversation);
  const setFlags = useServerFn(updateConversationFlags);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const q = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: () => fetchList(),
    refetchInterval: 20_000,
  });

  const all = q.data ?? [];
  const counts = useMemo(
    () => ({
      all: all.filter((c) => !c.is_archived).length,
      unread: all.filter((c) => c.unread > 0 && !c.is_archived).length,
      buyer: all.filter((c) => c.my_role === "buyer" && c.kind === "deal" && !c.is_archived).length,
      seller: all.filter((c) => c.my_role === "seller" && !c.is_archived).length,
      support: all.filter((c) => c.kind === "support").length,
      archived: all.filter((c) => c.is_archived).length,
    }),
    [all],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return all.filter((c) => {
      if (filter === "archived") {
        if (!c.is_archived) return false;
      } else if (c.is_archived) return false;
      if (filter === "unread" && c.unread === 0) return false;
      if (filter === "buyer" && !(c.my_role === "buyer" && c.kind === "deal")) return false;
      if (filter === "seller" && c.my_role !== "seller") return false;
      if (filter === "support" && c.kind !== "support") return false;
      if (term && !`${c.peer_name} ${c.last_message_preview ?? ""}`.toLowerCase().includes(term))
        return false;
      return true;
    });
  }, [all, filter, query]);

  const openSupport = async () => {
    try {
      const res = await open({ data: { support: true } });
      navigate({ to: "/messages/$conversationId", params: { conversationId: res.id } });
    } catch {
      toast.error("Не удалось открыть обращение в поддержку");
    }
  };

  const toggle = async (c: ConversationSummary, patch: { is_pinned?: boolean; is_archived?: boolean }) => {
    try {
      await setFlags({ data: { conversation_id: c.id, ...patch } });
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
    } catch {
      toast.error("Не удалось обновить диалог");
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-4 md:py-8">
        <div className="mb-4 flex items-start justify-between gap-3 md:mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Сообщения</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Диалоги с продавцами и покупателями
              {counts.unread > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-brand">{counts.unread} новых</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void openSupport()}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition hover:border-brand"
          >
            <Headphones className="h-4 w-4" />
            <span className="hidden sm:inline">Поддержка</span>
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по имени или сообщению"
            className="h-11 w-full rounded-full border bg-white pl-10 pr-10 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full hover:bg-surface"
              aria-label="Очистить"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {(
            [
              { k: "all", label: "Все", n: counts.all },
              { k: "unread", label: "Непрочитанные", n: counts.unread },
              { k: "buyer", label: "Мои покупки", n: counts.buyer },
              { k: "seller", label: "Мои продажи", n: counts.seller },
              { k: "support", label: "Поддержка", n: counts.support },
              { k: "archived", label: "Архив", n: counts.archived },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setFilter(t.k)}
              className={`h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition ${
                filter === t.k
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-white text-foreground hover:border-foreground/40"
              }`}
            >
              {t.label}
              <span
                className={`ml-1.5 text-xs ${filter === t.k ? "opacity-70" : "text-muted-foreground"}`}
              >
                {t.n}
              </span>
            </button>
          ))}
        </div>

        {q.isLoading ? (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-white">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex animate-pulse items-center gap-3 p-4">
                <div className="h-12 w-12 rounded-full bg-surface" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-surface" />
                  <div className="h-3 w-2/3 rounded bg-surface" />
                </div>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <EmptyState hasAny={all.length > 0} hasQuery={!!query} onSupport={() => void openSupport()} />
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-white shadow-sm">
            {filtered.map((c) => (
              <ConversationRow
                key={c.id}
                c={c}
                meId={user?.id ?? ""}
                onPin={() => void toggle(c, { is_pinned: !c.is_pinned })}
                onArchive={() => void toggle(c, { is_archived: !c.is_archived })}
              />
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}

function ConversationRow({
  c,
  meId,
  onPin,
  onArchive,
}: {
  c: ConversationSummary;
  meId: string;
  onPin: () => void;
  onArchive: () => void;
}) {
  const preview = c.last_message_preview
    ? `${c.last_sender_id === meId ? "Вы: " : ""}${c.last_message_preview}`
    : "Нет сообщений";

  return (
    <li className="relative flex items-center gap-1 hover:bg-surface">
      <Link
        to="/messages/$conversationId"
        params={{ conversationId: c.id }}
        className="flex min-w-0 flex-1 items-center gap-3 p-3 md:p-4"
      >
        <div className="relative shrink-0">
          {c.kind === "support" ? (
            <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand md:h-14 md:w-14">
              <Headphones className="h-6 w-6" />
            </div>
          ) : c.peer_logo_url ? (
            <img
              src={c.peer_logo_url}
              alt=""
              loading="lazy"
              className="h-12 w-12 rounded-full border object-cover md:h-14 md:w-14"
            />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft font-semibold text-brand md:h-14 md:w-14">
              {c.peer_name.slice(0, 1).toUpperCase()}
            </div>
          )}
          {c.kind === "deal" && (
            <div className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border bg-white">
              {c.my_role === "buyer" ? (
                <Store className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ShoppingBag className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className={`flex min-w-0 items-center gap-1.5 ${c.unread ? "font-semibold" : "font-medium"}`}>
              {c.is_pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-brand" />}
              <span className="truncate">{c.peer_name}</span>
              {c.muted && <BellOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            </div>
            <div className={`shrink-0 text-xs ${c.unread ? "font-medium text-brand" : "text-muted-foreground"}`}>
              {fmt(c.last_message_at)}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {c.kind === "support"
              ? c.support_status === "closed"
                ? "Обращение закрыто"
                : "Поддержка Kupiks"
              : c.my_role === "buyer"
                ? "Продавец"
                : "Покупатель"}
          </div>
          <div
            className={`mt-0.5 truncate text-sm ${
              c.unread ? "font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            {preview}
          </div>
        </div>

        {c.unread > 0 && (
          <span className="grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-foreground">
            {c.unread > 99 ? "99+" : c.unread}
          </span>
        )}
      </Link>

      <div className="flex shrink-0 flex-col pr-2 md:flex-row md:gap-1">
        <button
          type="button"
          onClick={onPin}
          title={c.is_pinned ? "Открепить" : "Закрепить"}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white"
        >
          {c.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onArchive}
          title={c.is_archived ? "Вернуть из архива" : "В архив"}
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white"
        >
          {c.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
        </button>
      </div>
    </li>
  );
}

function EmptyState({
  hasAny,
  hasQuery,
  onSupport,
}: {
  hasAny: boolean;
  hasQuery: boolean;
  onSupport: () => void;
}) {
  if (hasQuery)
    return (
      <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
        <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="font-medium">Ничего не найдено</p>
        <p className="mt-1 text-sm text-muted-foreground">Попробуйте изменить запрос</p>
      </div>
    );
  if (hasAny)
    return (
      <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
        <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">В этой категории диалогов нет.</p>
      </div>
    );
  return (
    <div className="rounded-2xl border border-dashed bg-white p-10 text-center md:p-14">
      <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand">
        <MessageCircle className="h-8 w-8" />
      </div>
      <p className="text-lg font-semibold">Пока нет сообщений</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Напишите продавцу с карточки товара или из заказа — вся переписка будет здесь. Есть вопрос по
        сервису? Напишите в поддержку.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          to="/catalog"
          className="inline-flex h-10 items-center rounded-full bg-brand px-5 text-sm font-medium text-brand-foreground transition hover:opacity-90"
        >
          Перейти в каталог
        </Link>
        <button
          type="button"
          onClick={onSupport}
          className="inline-flex h-10 items-center gap-2 rounded-full border px-5 text-sm font-medium hover:border-brand"
        >
          <Headphones className="h-4 w-4" /> Написать в поддержку
        </button>
      </div>
    </div>
  );
}
