// Каркас приложения — Askona-style: мягкий серый фон, крупная пилюля поиска,
// круглая бирюзовая кнопка меню, минималистичная шапка.
// Мобильная версия: sticky header со скрытием при скролле, нижняя навигация
// на 5 пунктов с бейджами непрочитанных и корзины + safe-area.
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  ShoppingCart,
  User,
  Store,
  Home,
  Menu,
  Phone,
  Package,
  ClipboardList,
  BarChart3,
  Wallet,
  ArrowLeftRight,
  MessageCircle,
} from "lucide-react";
import { useEffect, useState, type ReactNode, type ComponentType, type SVGProps } from "react";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/use-auth";
import { useMode } from "@/lib/mode-store";
import { useUnreadChats } from "@/lib/use-unread-chats";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import logo from "@/assets/breeze-logo.png.asset.json";
import { SignInPromptDialog } from "@/components/SignInPromptDialog";
import { CatalogSearchBar } from "@/components/CatalogSearchBar";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: "cart" | "unread";
  exact?: boolean;
};

// Нижнее мобильное меню — 5 пунктов, свой набор для каждого режима
const buyerMobileNav: readonly NavItem[] = [
  { to: "/", label: "Главная", icon: Home, exact: true },
  { to: "/catalog", label: "Каталог", icon: Menu },
  { to: "/cart", label: "Корзина", icon: ShoppingCart, badge: "cart" },
  { to: "/messages", label: "Чаты", icon: MessageCircle, badge: "unread" },
  { to: "/account", label: "Кабинет", icon: User },
];

const sellerMobileNav: readonly NavItem[] = [
  { to: "/seller/products", label: "Товары", icon: Package },
  { to: "/seller/orders", label: "Заказы", icon: ClipboardList },
  { to: "/seller/analytics", label: "Аналитика", icon: BarChart3 },
  { to: "/seller/balance", label: "Финансы", icon: Wallet },
  { to: "/messages", label: "Чаты", icon: MessageCircle, badge: "unread" },
];

// Верхнее меню (desktop)
const buyerTopNav = [
  { to: "/catalog", label: "Каталог" },
  { to: "/catalog", label: "Акции" },
  { to: "/catalog", label: "Новинки" },
] as const;

const sellerTopNav = [
  { to: "/seller/products", label: "Мои товары" },
  { to: "/seller/orders", label: "Заказы" },
  { to: "/seller/analytics", label: "Аналитика" },
  { to: "/seller/balance", label: "Баланс" },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
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

  const count = mounted ? rawCount : 0;
  const mode = mounted ? rawMode : "buyer";
  const unreadChats = mounted ? rawUnread : 0;

  useEffect(() => {
    if (!isSeller && mode === "seller") setMode("buyer");
  }, [isSeller, mode, setMode]);

  useEffect(() => {
    if (isSeller && pathname.startsWith("/seller") && mode !== "seller") {
      setMode("seller");
    }
  }, [pathname, isSeller, mode, setMode]);

  const effectiveMode: "buyer" | "seller" = isSeller && mode === "seller" ? "seller" : "buyer";
  const topNav = effectiveMode === "seller" ? sellerTopNav : buyerTopNav;
  const mobileNav = effectiveMode === "seller" ? sellerMobileNav : buyerMobileNav;
  const accountHref = effectiveMode === "seller" ? "/seller/products" : "/account";

  const goSearch = (v: string) =>
    navigate({ to: "/catalog", search: { q: v || undefined } as never });

  const switchMode = (next: "buyer" | "seller") => {
    setMode(next);
    if (next === "seller") navigate({ to: "/seller/products" });
    else navigate({ to: "/account" });
  };

  const sellerModeUi = effectiveMode === "seller";

  return (
    <div className={`min-h-[100dvh] flex flex-col text-foreground transition-colors ${sellerModeUi ? "bg-brand-soft/40" : "bg-white"}`}>
      {/* Шапка — sticky, скрывается при скролле вниз на мобильном */}
      <header
        className={`sticky top-0 z-40 backdrop-blur border-b transition-transform duration-300 will-change-transform ${
          sellerModeUi
            ? "bg-white/95 supports-[backdrop-filter]:bg-white/85 border-brand/30"
            : "bg-white/95 supports-[backdrop-filter]:bg-white/85 border-border/60"
        } ${headerHidden ? "-translate-y-full md:translate-y-0" : "translate-y-0"}`}
      >
        {user && (
          <div
            className={`w-full flex items-center justify-center gap-2 text-xs font-semibold py-1.5 px-3 ${
              sellerModeUi
                ? "bg-brand text-brand-foreground"
                : "bg-foreground text-white"
            }`}
          >
            {sellerModeUi ? <Store className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            <span className="uppercase tracking-wider">
              {sellerModeUi ? "Кабинет продавца" : "Режим покупателя"}
            </span>
            {isSeller && (
              <button
                onClick={() => switchMode(sellerModeUi ? "buyer" : "seller")}
                className={`ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                  sellerModeUi
                    ? "bg-white/20 text-white hover:bg-white/30"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                <ArrowLeftRight className="h-3 w-3" />
                {sellerModeUi ? "Стать покупателем" : "Стать продавцом"}
              </button>
            )}
          </div>
        )}

        <div className="mx-auto max-w-7xl px-4 h-14 md:h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center shrink-0" aria-label="BREEZE">
            <img src={logo.url} alt="BREEZE" className="h-7 md:h-9 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-6 text-sm">
            {topNav.map((it, i) => (
              <Link
                key={i}
                to={it.to}
                className="px-3 py-2 rounded-full font-medium text-foreground/80 hover:text-brand transition"
              >
                {it.label}
              </Link>
            ))}
            {!isSeller && effectiveMode === "buyer" && (
              <Link
                to="/auth"
                search={{ as: "seller", mode: "signup" } as never}
                className="px-3 py-2 rounded-full font-medium text-brand hover:text-brand-strong transition"
              >
                Продавать на BREEZE
              </Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <a
              href="tel:88001234567"
              className="hidden sm:inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface transition"
              aria-label="Позвонить"
            >
              <Phone className="h-5 w-5" />
            </a>

            {isAdmin && (
              <Link
                to="/admin"
                className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold bg-foreground text-white hover:bg-foreground/85 transition"
                aria-label="Админ-панель"
              >
                Админ
              </Link>
            )}



            {user && isSeller && effectiveMode === "buyer" && (
              <button
                onClick={() => switchMode("seller")}
                className="hidden md:inline-flex items-center gap-2 h-10 px-3 rounded-full text-sm font-medium text-foreground hover:bg-surface transition"
              >
                <Store className="h-4 w-4" /> Кабинет продавца
              </button>
            )}

            {effectiveMode === "buyer" && (
              <Link
                to="/cart"
                className="relative hidden md:inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface transition"
                aria-label="Корзина"
              >
                <ShoppingCart className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute top-0 right-0 min-w-[18px] h-[18px] rounded-full bg-brand text-[10px] font-bold text-brand-foreground flex items-center justify-center px-1 ring-2 ring-white">
                    {count}
                  </span>
                )}
              </Link>
            )}

            {user && (
              <Link
                to="/messages"
                className="relative hidden md:inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface transition"
                aria-label="Сообщения"
              >
                <MessageCircle className="h-5 w-5" />
                {unreadChats > 0 && (
                  <span className="absolute top-0 right-0 min-w-[18px] h-[18px] rounded-full bg-brand text-[10px] font-bold text-brand-foreground flex items-center justify-center px-1 ring-2 ring-white">
                    {unreadChats > 9 ? "9+" : unreadChats}
                  </span>
                )}
              </Link>
            )}

            <Link
              to={user ? accountHref : "/auth"}
              className="inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface transition"
              aria-label={user ? "Кабинет" : "Войти"}
            >
              <User className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Полоса поиска — только в режиме покупателя */}
        {effectiveMode === "buyer" && (
          <div className="mx-auto max-w-7xl px-4 pb-3">
            <div className="flex items-center gap-2.5">
              <Link
                to="/catalog"
                className="shrink-0 inline-flex items-center justify-center h-12 w-12 rounded-full bg-brand text-brand-foreground shadow-sm hover:bg-brand-strong transition"
                aria-label="Каталог"
              >
                <Menu className="h-5 w-5" />
              </Link>
              <div className="flex-1 min-w-0">
                <CatalogSearchBar value="" onSubmit={goSearch} placeholder="Поиск" />
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 pb-nav md:pb-0 bg-white">{children}</main>
      <SignInPromptDialog />

      {/* Футер (desktop) */}
      <footer className="hidden md:block bg-foreground text-white/80 mt-8">
        <div className="mx-auto max-w-7xl px-4 py-10 grid grid-cols-4 gap-8 text-sm">
          <div>
            <img src={logo.url} alt="BREEZE" className="h-8 w-auto bg-white p-1.5 rounded-lg" />
            <p className="mt-3 text-white/60 text-xs leading-relaxed">
              Маркетплейс товаров для дома, отдыха и стиля.
            </p>
          </div>
          <div>
            <div className="text-white font-semibold mb-3">Покупателям</div>
            <ul className="space-y-1.5 text-white/70">
              <li><Link to="/catalog" className="hover:text-brand transition">Каталог</Link></li>
              <li><Link to="/cart" className="hover:text-brand transition">Корзина</Link></li>
              <li><Link to="/account" className="hover:text-brand transition">Мои заказы</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-white font-semibold mb-3">Продавцам</div>
            <ul className="space-y-1.5 text-white/70">
              <li><Link to="/auth" search={{ as: "seller", mode: "signup" } as never} className="hover:text-brand transition">Начать продавать</Link></li>
              <li><Link to="/seller/products" className="hover:text-brand transition">Мои товары</Link></li>
              <li><Link to="/seller/analytics" className="hover:text-brand transition">Аналитика</Link></li>
              <li><Link to="/seller/balance" className="hover:text-brand transition">Баланс</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-white font-semibold mb-3">BREEZE</div>
            <ul className="space-y-1.5 text-white/70">
              <li>О маркетплейсе</li>
              <li>Помощь</li>
              <li>Контакты</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
          © {new Date().getFullYear()} BREEZE Marketplace
        </div>
      </footer>

      {/* Нижняя навигация — мобильная, 5 пунктов, safe-area */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-white/95 backdrop-blur safe-pb">
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
              item.badge === "cart" ? count : item.badge === "unread" ? unreadChats : 0;
            return (
              <Link
                key={`${item.to}-${i}`}
                to={item.to}
                className={`flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-medium transition touch-target ${
                  active ? "text-brand" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`h-6 w-6 transition-transform ${active ? "scale-110" : ""}`}
                    strokeWidth={active ? 2 : 1.75}
                  />
                  {badgeN > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full bg-brand text-[10px] font-bold text-white flex items-center justify-center px-1 ring-2 ring-white">
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
    </div>
  );
}
