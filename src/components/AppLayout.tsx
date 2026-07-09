// Каркас приложения — Askona-style: мягкий серый фон, крупная пилюля поиска,
// круглая бирюзовая кнопка меню, минималистичная шапка.
// Навигация и нижнее меню перестраиваются под режим «Покупатель / Продавец».
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  ShoppingCart,
  User,
  Store,
  Search,
  Home,
  Menu,
  Phone,
  Package,
  ClipboardList,
  BarChart3,
  Wallet,
  ArrowLeftRight,
  ShoppingBag,
  MessageCircle,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/use-auth";
import { useMode } from "@/lib/mode-store";
import { useUnreadChats } from "@/lib/use-unread-chats";
import logo from "@/assets/breeze-logo.png.asset.json";
import { SignInPromptDialog } from "@/components/SignInPromptDialog";
import { CatalogSearchBar } from "@/components/CatalogSearchBar";

// Нижнее мобильное меню — свой набор для каждого режима
const buyerMobileNav = [
  { to: "/catalog", label: "Каталог", icon: Menu },
  { to: "/cart", label: "Корзина", icon: ShoppingCart },
  { to: "/account", label: "Заказы", icon: ShoppingBag },
  { to: "/account", label: "Кабинет", icon: User },
] as const;

const sellerMobileNav = [
  { to: "/seller/products", label: "Товары", icon: Package },
  { to: "/seller/orders", label: "Заказы", icon: ClipboardList },
  { to: "/seller/analytics", label: "Аналитика", icon: BarChart3 },
  { to: "/seller/balance", label: "Финансы", icon: Wallet },
] as const;

// Верхнее меню (desktop) — свой набор для каждого режима
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
  // На сервере Zustand-persist читать localStorage не может — рендерим одинаково,
  // чтобы избежать hydration mismatch. Реальные значения появятся после монтирования.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const rawCount = useCart((s) => s.totalCount());
  const { user, isSeller } = useAuth();
  const rawMode = useMode((s) => s.mode);
  const setMode = useMode((s) => s.setMode);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const rawUnread = useUnreadChats();

  const count = mounted ? rawCount : 0;
  const mode = mounted ? rawMode : "buyer";
  const unreadChats = mounted ? rawUnread : 0;


  // Пользователи без роли продавца всегда в режиме покупателя
  useEffect(() => {
    if (!isSeller && mode === "seller") setMode("buyer");
  }, [isSeller, mode, setMode]);

  // Автоматически переключаем режим при заходе в раздел /seller/*
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

  return (
    <div className="min-h-screen flex flex-col bg-white text-foreground">
      {/* Шапка */}
      <header className="sticky top-0 z-40 bg-white">
        {/* Индикатор роли */}
        {user && (
          <div
            className={`w-full text-center text-[11px] font-medium py-1 ${
              effectiveMode === "seller"
                ? "bg-brand text-brand-foreground"
                : "bg-surface text-foreground/70"
            }`}
          >
            {effectiveMode === "seller" ? "Режим продавца" : "Режим покупателя"}
            {isSeller && (
              <button
                onClick={() => switchMode(effectiveMode === "seller" ? "buyer" : "seller")}
                className={`ml-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                  effectiveMode === "seller"
                    ? "bg-white/15 text-white hover:bg-white/25"
                    : "bg-brand/10 text-brand hover:bg-brand/20"
                }`}
              >
                <ArrowLeftRight className="h-3 w-3" />
                {effectiveMode === "seller" ? "В покупатели" : "В продавцы"}
              </button>
            )}
          </div>
        )}

        {/* Верхняя полоса: логотип + иконки */}
        <div className="mx-auto max-w-7xl px-4 h-14 md:h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center shrink-0" aria-label="BREEZE">
            <img src={logo.url} alt="BREEZE" className="h-7 md:h-9 w-auto" />
          </Link>

          {/* Desktop-меню */}
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
            {/* Ссылка «стать продавцом» — только для тех, у кого нет роли */}
            {!isSeller && effectiveMode === "buyer" && (
              <Link
                to="/auth"
                className="px-3 py-2 rounded-full font-medium text-foreground/60 hover:text-brand transition"
              >
                Продавать
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

            {/* Быстрая ссылка на кабинет продавца — только сверху для продавцов */}
            {user && isSeller && effectiveMode === "buyer" && (
              <button
                onClick={() => switchMode("seller")}
                className="hidden md:inline-flex items-center gap-2 h-10 px-3 rounded-full text-sm font-medium text-foreground hover:bg-surface transition"
              >
                <Store className="h-4 w-4" /> Кабинет продавца
              </button>
            )}

            {/* Корзина показывается только покупателям */}
            {effectiveMode === "buyer" && (
              <Link
                to="/cart"
                className="relative inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface transition"
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
                className="relative inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface transition"
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
            <form onSubmit={submitSearch} className="flex items-center gap-2.5">
              <Link
                to="/catalog"
                className="shrink-0 inline-flex items-center justify-center h-12 w-12 rounded-full bg-brand text-brand-foreground shadow-sm hover:bg-brand-strong transition"
                aria-label="Каталог"
              >
                <Menu className="h-5 w-5" />
              </Link>
              <div className="flex-1 flex items-center h-12 rounded-full bg-surface pl-4 pr-2 focus-within:ring-2 focus-within:ring-brand/30 transition">
                <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  type="search"
                  placeholder="Поиск"
                  className="flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground/80 min-w-0"
                />
              </div>
            </form>
          </div>
        )}
      </header>

      <main className="flex-1 pb-24 md:pb-0 bg-white">{children}</main>
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
              <li><Link to="/auth" className="hover:text-brand transition">Начать продавать</Link></li>
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

      {/* Нижняя навигация */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-white">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))` }}>
          {mobileNav.map((item, i) => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(item.to);
            return (
              <Link
                key={`${item.to}-${i}`}
                to={item.to}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition ${
                  active ? "text-brand" : "text-foreground/70"
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                  {item.to === "/cart" && count > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-4 rounded-full bg-brand text-[9px] font-bold text-white flex items-center justify-center px-1">
                      {count}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Плавающая кнопка «Главная» — только не на главной */}
      {pathname !== "/" ? (
        <Link
          to="/"
          className="md:hidden fixed right-3 bottom-20 z-40 h-11 w-11 rounded-full bg-white shadow-lg border border-border flex items-center justify-center text-foreground/70 hover:text-brand transition"
          aria-label="Главная"
        >
          <Home className="h-5 w-5" />
        </Link>
      ) : null}
    </div>
  );
}
