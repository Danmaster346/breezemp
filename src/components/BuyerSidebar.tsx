// Сайдбар покупателя — используется в кабинете покупателя.
import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag, Heart, MessageCircle, User, Store, LogOut, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUnreadChats } from "@/lib/use-unread-chats";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

type Item = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  hint?: string;
};

export function BuyerSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const unread = useUnreadChats();
  const { user, isSeller } = useAuth();
  const navigate = useNavigate();

  const items: Item[] = [
    { to: "/account", label: "Мои заказы", icon: ShoppingBag },
    { to: "/favorites", label: "Избранное", icon: Heart },
    { to: "/messages", label: "Сообщения", icon: MessageCircle, badge: unread },
  ];

  const displayName =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    user?.email ||
    "Мой кабинет";

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-1 sticky top-24 self-start">
      <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-surface mb-2">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-brand text-brand-foreground shrink-0">
          <User className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Покупатель</div>
          <div className="text-sm font-semibold truncate">{displayName}</div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {items.map((it) => {
          const Icon = it.icon;
          const active = pathname === it.to || pathname.startsWith(it.to + "/");
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium ui-transition ${
                active
                  ? "bg-brand/10 text-brand"
                  : "text-foreground/80 hover:bg-surface hover:text-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.75} />
              <span className="flex-1 truncate">{it.label}</span>
              {it.badge && it.badge > 0 ? (
                <span className="min-w-[20px] h-5 px-1.5 grid place-items-center rounded-full bg-brand text-brand-foreground text-[11px] font-bold">
                  {it.badge > 9 ? "9+" : it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 pt-3 border-t space-y-1">
        {isSeller ? (
          <Link
            to="/seller/products"
            className="flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-semibold bg-foreground text-background hover:opacity-90 ui-transition"
          >
            <Store className="h-[18px] w-[18px]" strokeWidth={1.75} />
            Кабинет продавца
          </Link>
        ) : (
          <Link
            to="/auth"
            search={{ as: "seller", mode: "signup" } as never}
            className="flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-semibold text-brand hover:bg-brand/10 ui-transition"
          >
            <Store className="h-[18px] w-[18px]" strokeWidth={1.75} />
            Стать продавцом
          </Link>
        )}
        <button
          type="button"
          onClick={signOut}
          className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground ui-transition"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
          Выйти
        </button>
      </div>
    </aside>
  );
}

/** Горизонтальные табы кабинета покупателя для мобильной версии. */
export function BuyerTabs() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const unread = useUnreadChats();
  const items: Item[] = [
    { to: "/account", label: "Заказы", icon: Package },
    { to: "/favorites", label: "Избранное", icon: Heart },
    { to: "/messages", label: "Сообщения", icon: MessageCircle, badge: unread },
  ];
  return (
    <div className="lg:hidden -mx-4 px-4 mb-4 overflow-x-auto no-scrollbar">
      <div className="flex gap-2 min-w-max">
        {items.map((it) => {
          const Icon = it.icon;
          const active = pathname === it.to || pathname.startsWith(it.to + "/");
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-semibold ui-transition ${
                active
                  ? "bg-brand text-brand-foreground"
                  : "bg-surface text-foreground/80 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.75} />
              {it.label}
              {it.badge && it.badge > 0 ? (
                <span className={`min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-brand text-brand-foreground"}`}>
                  {it.badge > 9 ? "9+" : it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
