// Тёмный сайдбар кабинета продавца — форсит mode-seller при монтировании.
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Package,
  ClipboardList,
  BarChart3,
  Wallet,
  Settings,
  MessageCircle,
  Store,
  ArrowLeftRight,
  Undo2,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMode } from "@/lib/mode-store";
import { useAuth } from "@/lib/use-auth";
import { useUnreadChats } from "@/lib/use-unread-chats";
import { supabase } from "@/integrations/supabase/client";

type Item = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

/** Форсит режим продавца — используется корневым макетом кабинета. */
export function useForceSellerMode() {
  const setMode = useMode((s) => s.setMode);
  const { isSeller } = useAuth();
  useEffect(() => {
    if (isSeller) setMode("seller");
  }, [isSeller, setMode]);
}

export function SellerSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();
  const setMode = useMode((s) => s.setMode);
  const unread = useUnreadChats();

  const items: Item[] = [
    { to: "/seller/products", label: "Мои товары", icon: Package },
    { to: "/seller/orders", label: "Заказы", icon: ClipboardList },
    { to: "/seller/returns", label: "Возвраты", icon: Undo2 },
    { to: "/seller/analytics", label: "Аналитика", icon: BarChart3 },
    { to: "/seller/balance", label: "Баланс", icon: Wallet },
    { to: "/messages", label: "Сообщения", icon: MessageCircle, badge: unread },
    { to: "/seller/settings", label: "Настройки", icon: Settings },
  ];

  const displayName =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ||
    user?.email ||
    "Продавец";

  const toBuyer = () => {
    setMode("buyer");
    navigate({ to: "/account" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col sticky top-24 self-start">
      <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-card hairline mb-2">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-brand text-brand-foreground shrink-0">
          <Store className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Продавец</div>
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
                  ? "bg-brand text-brand-foreground"
                  : "text-foreground/80 hover:bg-surface hover:text-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.75} />
              <span className="flex-1 truncate">{it.label}</span>
              {it.badge && it.badge > 0 ? (
                <span className={`min-w-[20px] h-5 px-1.5 grid place-items-center rounded-full text-[11px] font-bold ${active ? "bg-brand-foreground/20 text-brand-foreground" : "bg-brand text-brand-foreground"}`}>
                  {it.badge > 9 ? "9+" : it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 pt-3 border-t border-border space-y-1">
        <button
          type="button"
          onClick={toBuyer}
          className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-semibold bg-surface hover:bg-surface-strong ui-transition"
        >
          <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={1.75} />
          Режим покупателя
        </button>
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

/** Горизонтальные табы кабинета продавца для мобильной версии. */
export function SellerTabs() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const unread = useUnreadChats();
  const items: Item[] = [
    { to: "/seller/products", label: "Товары", icon: Package },
    { to: "/seller/orders", label: "Заказы", icon: ClipboardList },
    { to: "/seller/returns", label: "Возвраты", icon: Undo2 },
    { to: "/seller/analytics", label: "Аналитика", icon: BarChart3 },
    { to: "/seller/balance", label: "Баланс", icon: Wallet },
    { to: "/messages", label: "Чаты", icon: MessageCircle, badge: unread },
    { to: "/seller/settings", label: "Настройки", icon: Settings },
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
                <span className={`min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full text-[10px] font-bold ${active ? "bg-brand-foreground/20 text-brand-foreground" : "bg-brand text-brand-foreground"}`}>
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
