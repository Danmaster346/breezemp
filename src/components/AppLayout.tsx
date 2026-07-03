// Общий каркас приложения BREEZE — премиальный e-commerce стиль (Amazon × Аскона)
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ShoppingCart, User, Store, Search, Home, MapPin, Menu } from "lucide-react";
import { useState, type ReactNode, type FormEvent } from "react";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/use-auth";
import logo from "@/assets/breeze-logo.png.asset.json";

const mobileNav = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/catalog", label: "Каталог", icon: Search },
  { to: "/cart", label: "Корзина", icon: ShoppingCart },
  { to: "/account", label: "Кабинет", icon: User },
];

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
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Верхняя шапка в стиле Amazon */}
      <header className="sticky top-0 z-40">
        {/* Основная полоса */}
        <div className="bg-white border-b border-border">
          <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-4">
            {/* Логотип BREEZE */}
            <Link to="/" className="flex items-center shrink-0" aria-label="BREEZE">
              <img src={logo.url} alt="BREEZE" className="h-8 md:h-9 w-auto" />
            </Link>

            {/* Локация (desktop) */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <MapPin className="h-4 w-4 text-brand" />
              <div className="leading-tight">
                <div className="text-[10px] uppercase tracking-wide">Доставка</div>
                <div className="font-semibold text-foreground">По всей России</div>
              </div>
            </div>

            {/* Поиск */}
            <form
              onSubmit={submitSearch}
              className="flex-1 hidden sm:flex items-center h-11 rounded-full border border-border bg-surface focus-within:border-brand focus-within:bg-white focus-within:ring-2 focus-within:ring-brand/20 transition overflow-hidden"
            >
              <Search className="h-4 w-4 text-muted-foreground ml-4 shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                placeholder="Поиск товаров на BREEZE"
                className="flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground min-w-0"
              />
              <button
                type="submit"
                className="h-11 px-5 text-sm font-semibold text-brand-foreground bg-brand hover:bg-brand/90 transition"
              >
                Найти
              </button>
            </form>

            {/* Правая часть */}
            <div className="ml-auto sm:ml-0 flex items-center gap-1">
              {user && isSeller && (
                <Link
                  to="/seller/products"
                  className="hidden md:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-surface transition"
                >
                  <Store className="h-4 w-4" /> Мои товары
                </Link>
              )}
              <Link
                to={user ? "/account" : "/auth"}
                className="hidden sm:inline-flex flex-col items-start rounded-lg px-3 py-1.5 hover:bg-surface transition"
              >
                <span className="text-[10px] text-muted-foreground leading-none">
                  {user ? "Привет!" : "Войдите"}
                </span>
                <span className="text-sm font-semibold leading-tight">
                  {user ? "Кабинет" : "Аккаунт"}
                </span>
              </Link>
              <Link
                to="/cart"
                className="relative inline-flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 text-sm font-semibold text-brand-foreground bg-brand hover:bg-brand/90 transition shadow-sm"
              >
                <ShoppingCart className="h-4 w-4" />
                <span className="hidden sm:inline">Корзина</span>
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-white text-brand text-[11px] font-bold flex items-center justify-center px-1.5 border border-brand shadow-sm">
                    {count}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        {/* Полоса категорий (Amazon-style, desktop) */}
        <div className="hidden md:block bg-[#232f3e] text-white/90 border-b border-black/10">
          <div className="mx-auto max-w-7xl px-4 h-10 flex items-center gap-1 text-sm">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-white/10 font-medium">
              <Menu className="h-4 w-4" /> Все категории
            </button>
            {[
              { to: "/catalog", label: "Каталог" },
              { to: "/catalog", label: "Новинки" },
              { to: "/catalog", label: "Популярное" },
              { to: "/catalog", label: "Скидки" },
              { to: "/auth", label: "Стать продавцом" },
            ].map((it, i) => (
              <Link
                key={i}
                to={it.to}
                className="px-3 py-1.5 rounded hover:bg-white/10 transition"
              >
                {it.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Мобильный поиск */}
        <form
          onSubmit={submitSearch}
          className="sm:hidden bg-white border-b border-border px-4 py-2.5 flex items-center h-12 gap-2"
        >
          <div className="flex-1 flex items-center h-10 rounded-full border border-border bg-surface overflow-hidden">
            <Search className="h-4 w-4 text-muted-foreground ml-3 shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              placeholder="Поиск на BREEZE"
              className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground min-w-0"
            />
          </div>
        </form>
      </header>

      <main className="flex-1 pb-20 md:pb-0 bg-surface">{children}</main>

      {/* Футер */}
      <footer className="hidden md:block bg-[#232f3e] text-white/80 mt-8">
        <div className="mx-auto max-w-7xl px-4 py-10 grid grid-cols-4 gap-8 text-sm">
          <div>
            <img src={logo.url} alt="BREEZE" className="h-8 w-auto bg-white p-1.5 rounded" />
            <p className="mt-3 text-white/60 text-xs leading-relaxed">
              Премиальный маркетплейс с товарами от продавцов со всей России.
            </p>
          </div>
          <div>
            <div className="text-white font-semibold mb-3">Покупателям</div>
            <ul className="space-y-1.5 text-white/70">
              <li><Link to="/catalog" className="hover:text-white">Каталог</Link></li>
              <li><Link to="/cart" className="hover:text-white">Корзина</Link></li>
              <li><Link to="/account" className="hover:text-white">Мои заказы</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-white font-semibold mb-3">Продавцам</div>
            <ul className="space-y-1.5 text-white/70">
              <li><Link to="/auth" className="hover:text-white">Начать продавать</Link></li>
              <li><Link to="/seller/products" className="hover:text-white">Мои товары</Link></li>
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

      {/* Нижняя навигация (мобилка) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-white/95 backdrop-blur">
        <div className="grid grid-cols-4">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium ${
                  active ? "text-brand" : "text-muted-foreground"
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
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
    </div>
  );
}
