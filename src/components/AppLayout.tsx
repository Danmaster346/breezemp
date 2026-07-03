// Общий каркас приложения: шапка на десктопе и нижняя навигация на мобильном
import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingCart, User, Store, Search, Home } from "lucide-react";
import type { ReactNode } from "react";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/use-auth";

// Пункты нижней навигации (мобилка)
const mobileNav = [
  { to: "/", label: "Главная", icon: Home }, // главная страница
  { to: "/catalog", label: "Каталог", icon: Search }, // каталог товаров
  { to: "/cart", label: "Корзина", icon: ShoppingCart }, // корзина
  { to: "/account", label: "Кабинет", icon: User }, // личный кабинет
];

// Основной макет с шапкой, контентом и нижней навигацией
export function AppLayout({ children }: { children: ReactNode }) {
  // Счётчик товаров в корзине для бейджа
  const count = useCart((s) => s.totalCount());
  // Пользователь и роль для ссылок в шапке
  const { user, isSeller } = useAuth();
  // Текущий путь для подсветки активной ссылки
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Верхняя шапка */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-4">
          {/* Логотип */}
          <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-fuchsia-500 text-primary-foreground">
              B
            </span>
            <span className="hidden sm:inline">BreezeMarket</span>
          </Link>
          {/* Ссылка на каталог */}
          <Link
            to="/catalog"
            className="hidden md:inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" /> Каталог
          </Link>
          {/* Правая часть: кабинет, продавец, корзина */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {user && isSeller && (
              <Link
                to="/seller/products"
                className="hidden sm:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent"
              >
                <Store className="h-4 w-4" /> Мои товары
              </Link>
            )}
            <Link
              to={user ? "/account" : "/auth"}
              className="hidden sm:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-accent"
            >
              <User className="h-4 w-4" /> {user ? "Кабинет" : "Войти"}
            </Link>
            {/* Кнопка корзины с бейджем */}
            <Link
              to="/cart"
              className="relative inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Корзина</span>
              {count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-fuchsia-600 text-[10px] font-bold text-white flex items-center justify-center px-1">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Контент страницы */}
      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      {/* Нижняя навигация только для мобильных */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur">
        <div className="grid grid-cols-4">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            // Проверяем активность вкладки
            const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 text-xs ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.to === "/cart" && count > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] rounded-full bg-fuchsia-600 text-[9px] font-bold text-white flex items-center justify-center px-1">
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
