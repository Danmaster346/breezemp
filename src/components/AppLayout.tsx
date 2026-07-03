// Каркас приложения — Askona-style: мягкий серый фон, крупная пилюля поиска,
// круглая бирюзовая кнопка меню, минималистичная шапка.
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  ShoppingCart,
  User,
  Store,
  Search,
  Home,
  Menu,
  Phone,
  Heart,
  Flame,
} from "lucide-react";
import { useState, type ReactNode, type FormEvent } from "react";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/use-auth";
import logo from "@/assets/breeze-logo.png.asset.json";

const mobileNav = [
  { to: "/catalog", label: "Каталог", icon: Menu },
  { to: "/catalog", label: "Акции", icon: Flame, search: { sort: "new" } },
  { to: "/cart", label: "Корзина", icon: ShoppingCart },
  { to: "/account", label: "Избранное", icon: Heart },
  { to: "/account", label: "Войти", icon: User },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const count = useCart((s) => s.totalCount());
  const { user, isSeller } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate({ to: "/catalog", search: { q: q || undefined } as never });
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-foreground">
      {/* Шапка */}
      <header className="sticky top-0 z-40 bg-white">
        {/* Верхняя полоса: логотип + иконки */}
        <div className="mx-auto max-w-7xl px-4 h-14 md:h-16 flex items-center gap-3">
          <Link to="/" className="flex items-center shrink-0" aria-label="BREEZE">
            <img src={logo.url} alt="BREEZE" className="h-7 md:h-9 w-auto" />
          </Link>

          {/* Desktop-меню */}
          <nav className="hidden md:flex items-center gap-1 ml-6 text-sm">
            {[
              { to: "/catalog", label: "Каталог" },
              { to: "/catalog", label: "Акции" },
              { to: "/catalog", label: "Новинки" },
              { to: "/auth", label: "Продавать" },
            ].map((it, i) => (
              <Link
                key={i}
                to={it.to}
                className="px-3 py-2 rounded-full font-medium text-foreground/80 hover:text-brand transition"
              >
                {it.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 md:gap-2">
            <a
              href="tel:88001234567"
              className="hidden sm:inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface transition"
              aria-label="Позвонить"
            >
              <Phone className="h-5 w-5" />
            </a>
            {user && isSeller && (
              <Link
                to="/seller/products"
                className="hidden md:inline-flex items-center gap-2 h-10 px-3 rounded-full text-sm font-medium text-foreground hover:bg-surface transition"
              >
                <Store className="h-4 w-4" /> Мои товары
              </Link>
            )}
            <Link
              to={user ? "/account" : "/auth"}
              className="hidden md:inline-flex items-center justify-center h-10 w-10 rounded-full text-foreground/80 hover:bg-surface transition"
              aria-label={user ? "Кабинет" : "Войти"}
            >
              <User className="h-5 w-5" />
            </Link>
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
          </div>
        </div>

        {/* Полоса поиска в стиле Askona: круглая бирюзовая кнопка меню + пилюля */}
        <div className="mx-auto max-w-7xl px-4 pb-3">
          <form
            onSubmit={submitSearch}
            className="flex items-center gap-2.5"
          >
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
      </header>

      <main className="flex-1 pb-24 md:pb-0 bg-white">{children}</main>

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

      {/* Нижняя навигация в стиле Askona */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-white">
        <div className="grid grid-cols-5">
          {mobileNav.map((item, i) => {
            const Icon = item.icon;
            const active =
              pathname === item.to || pathname.startsWith(item.to);
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
