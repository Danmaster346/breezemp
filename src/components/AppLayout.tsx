// Каркас Kupiks с двумя темами:
//   • buyer → янтарь-мандарин (по умолчанию)
//   • seller → чистый нуар (класс .mode-seller на <html>)
// Меню категорий, сегмент-переключатель ролей, мобильная bottom-nav.
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  ShoppingCart,
  User,
  Store,
  Home,
  Package,
  ClipboardList,
  BarChart3,
  Wallet,
  MessageCircle,
  Heart,
  LayoutGrid,
  ShoppingBag,
  Bell,
} from "lucide-react";
import { useEffect, useState, type ReactNode, type ComponentType, type SVGProps } from "react";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/use-auth";
import { useMode } from "@/lib/mode-store";
import { useUnreadChats } from "@/lib/use-unread-chats";
import { useFavoriteIds } from "@/lib/favorites-client";

import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";

import { SignInPromptDialog } from "@/components/SignInPromptDialog";
import { CatalogSearchBar } from "@/components/CatalogSearchBar";
import { CategoryMenu, CategorySheetButton } from "@/components/CategoryMenu";
import { ModeBadge, ModeSegmented } from "@/components/ModeSwitch";
import { getPreferredMode, setPreferredMode } from "@/lib/ui-mode.functions";
import { MessagesPanel } from "@/components/panels/MessagesPanel";
import { FavoritesPanel } from "@/components/panels/FavoritesPanel";
import { NotificationsPanel } from "@/components/panels/NotificationsPanel";
import { PushOptInBanner } from "@/components/PushOptInBanner";
import { useUnreadNotifications } from "@/lib/use-notifications";
import { toastNetworkError } from "@/lib/toasts";
import { usePanels } from "@/lib/panels-store";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicSettings } from "@/lib/admin/settings.functions";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: "cart" | "unread" | "favorites";
  exact?: boolean;
};

const buyerMobileNav: readonly NavItem[] = [
  { to: "/", label: "Главная", icon: Home, exact: true },
  { to: "/catalog", label: "Каталог", icon: LayoutGrid },
  { to: "/cart", label: "Корзина", icon: ShoppingCart, badge: "cart" },
  { to: "/favorites", label: "Избранное", icon: Heart, badge: "favorites" },
  { to: "/account", label: "Профиль", icon: User },
];


const sellerMobileNav: readonly NavItem[] = [
  { to: "/seller/products", label: "Товары", icon: Package },
  { to: "/seller/orders", label: "Заказы", icon: ClipboardList },
  { to: "/seller/analytics", label: "Аналитика", icon: BarChart3 },
  { to: "/seller/balance", label: "Баланс", icon: Wallet },
  { to: "/messages", label: "Чаты", icon: MessageCircle, badge: "unread" },
];

export function AppLayout({ children, hideMobileBottomNav = false }: { children: ReactNode; hideMobileBottomNav?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const rawCount = useCart((s) => s.totalCount());
  const { user, isSeller, isAdmin } = useAuth();
  const rawMode = useMode((s) => s.mode);
  const setMode = useMode((s) => s.setMode);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const rawUnread = useUnreadChats();
  const headerHidden = useHideOnScroll(6);
  const openMessages = usePanels((s) => s.openMessages);
  const openFavorites = usePanels((s) => s.openFavorites);
  const openNotifications = usePanels((s) => s.openNotifications);
  const rawUnreadNotifications = useUnreadNotifications();

  // Мягкая проверка режима обслуживания: не блокирует админов и служебные разделы.
  const getPublicSettingsFn = useServerFn(getPublicSettings);
  const { data: publicSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => getPublicSettingsFn(),
    staleTime: 60000,
  });
  const maintenanceActive =
    publicSettings?.maintenance_mode === "1" &&
    !isAdmin &&
    !pathname.startsWith("/admin") &&
    pathname !== "/auth";

  const count = mounted ? rawCount : 0;
  const mode = mounted ? rawMode : "buyer";
  const unreadChats = mounted ? rawUnread : 0;
  const unreadNotifications = mounted ? rawUnreadNotifications : 0;
  const { data: favoriteIds } = useFavoriteIds();
  const favoritesCount = mounted ? (favoriteIds?.length ?? 0) : 0;


  // Единое уведомление о потере соединения
  useEffect(() => {
    const onOffline = () => toastNetworkError("Некоторые действия будут недоступны");
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, []);

  useEffect(() => {
    if (!isSeller && mode === "seller") setMode("buyer");
  }, [isSeller, mode, setMode]);

  useEffect(() => {
    if (isSeller && pathname.startsWith("/seller") && mode !== "seller") {
      setMode("seller");
    }
  }, [pathname, isSeller, mode, setMode]);

  // Гидрация режима из профиля: режим запоминается за аккаунтом, а не только в браузере.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getPreferredMode()
      .then((r) => {
        if (!cancelled && r?.mode) setMode(r.mode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id, setMode]);

  const effectiveMode: "buyer" | "seller" = isSeller && mode === "seller" ? "seller" : "buyer";
  const sellerModeUi = effectiveMode === "seller";

  // Синхронизируем класс темы на <html>, чтобы страницы вне AppLayout тоже могли получить нужные токены.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("mode-seller", sellerModeUi);
    return () => {
      document.documentElement.classList.remove("mode-seller");
    };
  }, [sellerModeUi]);

  // «Кабинет» всегда ведёт в кабинет продавца, если пользователь — продавец,
  // независимо от текущего режима интерфейса. Переход в /seller/* авто-переключает mode.
  const accountHref = isSeller ? "/seller/products" : "/account";
  const baseMobileNav = sellerModeUi ? sellerMobileNav : buyerMobileNav;
  const mobileNav: readonly NavItem[] = sellerModeUi
    ? [...sellerMobileNav, { to: "/seller/settings", label: "Кабинет", icon: User }]
    : baseMobileNav.map((item) =>
        item.to === "/account" && isSeller ? { ...item, to: "/seller/products" } : item,
      );

  const goSearch = (v: string) =>
    navigate({ to: "/catalog", search: { q: v || undefined } as never });

  const switchMode = (next: "buyer" | "seller") => {
    setMode(next);
    void setPreferredMode({ data: { mode: next } }).catch(() => {});
    if (next === "seller") navigate({ to: "/seller/products", search: {} as never });
    else navigate({ to: "/account" });
  };

  if (maintenanceActive) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background text-foreground px-4 text-center gap-3">
        <span className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          kupiks<span className="text-brand">.</span>
        </span>
        <h1 className="text-2xl font-bold">Технические работы</h1>
        <p className="text-foreground/70 max-w-md">
          {publicSettings?.maintenance_message || "Мы проводим технические работы. Пожалуйста, зайдите позже."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header
        className={`sticky top-0 z-40 backdrop-blur border-b bg-background/90 supports-[backdrop-filter]:bg-background/75 transition-transform duration-300 will-change-transform ${
          sellerModeUi ? "border-b-2 border-brand" : "border-border"
        } ${headerHidden ? "-translate-y-full md:translate-y-0" : "translate-y-0"}`}
      >
        {/* Верхняя полоса: логотип · категории · переключатель · корзина/меню */}
        <div className="mx-auto max-w-7xl px-4 h-14 md:h-16 flex items-center gap-2 md:gap-3">
          <Link to="/" className="flex items-center shrink-0" aria-label="Kupiks">
            <span className="font-display text-2xl md:text-[26px] font-extrabold tracking-tight text-foreground">
              kupiks<span className="text-brand">.</span>
            </span>
          </Link>

          {/* Каталог (десктоп) */}
          <div className="hidden md:flex items-center gap-1 ml-3">
            <CategoryMenu />
            {!sellerModeUi && (
              <Link
                to="/catalog"
                search={{ sort: "new" } as never}
                className="hidden lg:inline-flex items-center h-10 px-3 rounded-full text-sm font-medium text-foreground/80 hover:bg-surface ui-transition"
              >
                Новинки
              </Link>
            )}
            {!sellerModeUi && (
              <Link
                to="/catalog"
                search={{ discount: true } as never}
                className="hidden lg:inline-flex items-center h-10 px-3 rounded-full text-sm font-medium text-foreground/80 hover:bg-surface ui-transition"
              >
                Акции
              </Link>
            )}
            {sellerModeUi && (
              <>
                <Link to="/seller/products" className="hidden lg:inline-flex items-center h-10 px-3 rounded-full text-sm font-medium text-foreground/80 hover:bg-surface ui-transition">Товары</Link>
                <Link to="/seller/orders" className="hidden lg:inline-flex items-center h-10 px-3 rounded-full text-sm font-medium text-foreground/80 hover:bg-surface ui-transition">Заказы</Link>
                <Link to="/seller/analytics" className="hidden lg:inline-flex items-center h-10 px-3 rounded-full text-sm font-medium text-foreground/80 hover:bg-surface ui-transition">Аналитика</Link>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1 md:gap-2">
            {/* Индикатор + переключатель режима */}
            {user && (
              <>
                <ModeBadge mode={effectiveMode} isSeller={isSeller} onSelect={switchMode} />
                <ModeSegmented mode={effectiveMode} isSeller={isSeller} onSelect={switchMode} />
              </>
            )}


            {isAdmin && (
              <Link
                to="/admin"
                className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold bg-foreground text-background hover:opacity-90 ui-transition"
              >
                Админ
              </Link>
            )}

            {!sellerModeUi && user && (
              <button
                type="button"
                onClick={openFavorites}
                className="relative hidden md:inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface ui-transition"
                aria-label="Избранное"
              >
                <Heart className="h-5 w-5" strokeWidth={1.75} />
              </button>
            )}

            {!sellerModeUi && (
              <Link
                to="/cart"
                className="relative hidden md:inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface ui-transition"
                aria-label="Корзина"
              >
                <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
                {count > 0 && (
                  <span className="absolute top-0 right-0 min-w-[18px] h-[18px] rounded-full bg-brand text-[10px] font-bold text-brand-foreground flex items-center justify-center px-1 ring-2 ring-background">
                    {count}
                  </span>
                )}
              </Link>
            )}

            {user && (
              <button
                type="button"
                onClick={openNotifications}
                className="relative inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface ui-transition"
                aria-label="Уведомления"
              >
                <Bell className="h-5 w-5" strokeWidth={1.75} />
                {unreadNotifications > 0 && (
                  <span className="absolute top-0 right-0 min-w-[18px] h-[18px] rounded-full bg-brand text-[10px] font-bold text-brand-foreground flex items-center justify-center px-1 ring-2 ring-background">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </button>
            )}

            {user && (
              <button
                type="button"
                onClick={() => openMessages()}
                className="relative inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface ui-transition"
                aria-label="Сообщения"
              >
                <MessageCircle className="h-5 w-5" strokeWidth={1.75} />
                {unreadChats > 0 && (
                  <span className="absolute top-0 right-0 min-w-[18px] h-[18px] rounded-full bg-brand text-[10px] font-bold text-brand-foreground flex items-center justify-center px-1 ring-2 ring-background">
                    {unreadChats > 9 ? "9+" : unreadChats}
                  </span>
                )}
              </button>
            )}


            <Link
              to={user ? accountHref : "/auth"}
              className="inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface ui-transition"
              aria-label={user ? "Кабинет" : "Войти"}
            >
              <User className="h-5 w-5" strokeWidth={1.75} />
            </Link>
          </div>
        </div>

        {/* Поиск (только режим покупателя) */}
        {!sellerModeUi && (
          <div className="mx-auto max-w-7xl px-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="md:hidden">
                <CategorySheetButton />
              </div>
              <div className="flex-1 min-w-0">
                <CatalogSearchBar value="" onSubmit={goSearch} placeholder="Поиск товаров..." />
              </div>
            </div>
          </div>
        )}
      </header>

      <main className={`flex-1 ${hideMobileBottomNav ? "" : "pb-nav"} md:pb-0`}>{children}</main>
      <SignInPromptDialog />
      <MessagesPanel />
      <FavoritesPanel />
      <NotificationsPanel />
      <PushOptInBanner />

      {/* Футер (десктоп) — единый семантический стиль под текущую тему */}
      <footer className="hidden md:block mt-12 border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-10 grid grid-cols-4 gap-8 text-sm">
          <div>
            <div className="font-display text-2xl font-extrabold text-foreground">
              kupiks<span className="text-brand">.</span>
            </div>
            <p className="mt-3 text-muted-foreground text-xs leading-relaxed">
              Маркетплейс товаров для дома, отдыха и стиля.
            </p>
          </div>
          <div>
            <div className="text-foreground font-semibold mb-3">Покупателям</div>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link to="/catalog" className="hover:text-brand ui-transition">Каталог</Link></li>
              <li><Link to="/cart" className="hover:text-brand ui-transition">Корзина</Link></li>
              <li><Link to="/account" className="hover:text-brand ui-transition">Мои заказы</Link></li>
              <li><Link to="/track-order" className="hover:text-brand ui-transition">Отследить заказ</Link></li>
              <li><Link to="/favorites" className="hover:text-brand ui-transition">Избранное</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-foreground font-semibold mb-3">Продавцам</div>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link to="/auth" search={{ as: "seller", mode: "signup" } as never} className="hover:text-brand ui-transition">Начать продавать</Link></li>
              <li><Link to="/seller/products" className="hover:text-brand ui-transition">Мои товары</Link></li>
              <li><Link to="/seller/analytics" className="hover:text-brand ui-transition">Аналитика</Link></li>
              <li><Link to="/seller/balance" className="hover:text-brand ui-transition">Баланс</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-foreground font-semibold mb-3">Kupiks</div>
            <ul className="space-y-1.5 text-muted-foreground">
              <li><Link to="/privacy" className="hover:text-brand ui-transition">Политика конфиденциальности</Link></li>
              <li><Link to="/help" className="hover:text-brand ui-transition">Помощь</Link></li>
              <li><Link to="/contacts" className="hover:text-brand ui-transition">Контакты</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Kupiks Marketplace
        </div>
      </footer>

      {/* Мобильная нижняя навигация */}
      {!hideMobileBottomNav && (
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card shadow-[0_-6px_20px_-8px_rgba(0,0,0,0.14)] safe-pb">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))` }}
        >
          {mobileNav.map((item, i) => {
            const Icon = item.icon;
            const active = item.exact
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(item.to + "/");
            const badgeN =
              item.badge === "cart"
                ? count
                : item.badge === "unread"
                  ? unreadChats
                  : item.badge === "favorites"
                    ? favoritesCount
                    : 0;
            return (
              <Link
                key={`${item.to}-${i}`}
                to={item.to}
                className={`flex flex-col items-center justify-center gap-1 h-[60px] text-[11px] font-medium ui-transition ${
                  active ? "text-brand" : "text-foreground/70 hover:text-foreground"
                }`}
              >

                <div className="relative">
                  <Icon
                    className={`h-6 w-6 transition-transform ${active ? "scale-110" : ""}`}
                    strokeWidth={active ? 2 : 1.75}
                  />
                  {badgeN > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full bg-brand text-[10px] font-bold text-brand-foreground flex items-center justify-center px-1 ring-2 ring-background">
                      {badgeN > 9 ? "9+" : badgeN}
                    </span>
                  )}
                </div>
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      )}
    </div>
  );
}
