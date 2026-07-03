// Обёртка кабинета продавца: подменю + подмаршруты
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Package, ClipboardList } from "lucide-react";

// Маршрут «/seller» — общая обёртка кабинета продавца
export const Route = createFileRoute("/_authenticated/seller")({
  component: SellerLayout,
});

// Список вкладок продавца
const tabs = [
  { to: "/seller/products", label: "Мои товары", icon: Package },
  { to: "/seller/orders", label: "Мои заказы", icon: ClipboardList },
];

// Компонент обёртки
function SellerLayout() {
  // Текущий путь для подсветки активной вкладки
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Кабинет продавца</h1>
        {/* Вкладки */}
        <div className="flex gap-2 mb-6 border-b">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = pathname === t.to;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`inline-flex items-center gap-2 px-4 py-2 border-b-2 -mb-px text-sm font-medium ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </Link>
            );
          })}
        </div>
        {/* Слот для подмаршрутов */}
        <Outlet />
      </div>
    </AppLayout>
  );
}
