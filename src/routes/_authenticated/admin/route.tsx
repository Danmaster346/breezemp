// Админ-лейаут: sidebar + гейт по роли admin
import { createFileRoute, Outlet, Link, useRouterState, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Users, Package, ShoppingBag, Undo2, Star, Grid3x3, TicketPercent, ScrollText, Home, Flag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const [{ data: role }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
      supabase.from("profiles").select("is_blocked").eq("id", uid).maybeSingle(),
    ]);
    if (!role || profile?.is_blocked) throw redirect({ to: "/" });
  },
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: React.ElementType; exact?: boolean };
const nav: readonly NavItem[] = [
  { to: "/admin", label: "Дашборд", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "Пользователи", icon: Users },
  { to: "/admin/products", label: "Товары", icon: Package },
  { to: "/admin/orders", label: "Заказы", icon: ShoppingBag },
  { to: "/admin/returns", label: "Возвраты", icon: Undo2 },
  { to: "/admin/reviews", label: "Отзывы", icon: Star },
  { to: "/admin/review-reports", label: "Жалобы", icon: Flag },
  { to: "/admin/categories", label: "Категории", icon: Grid3x3 },
  { to: "/admin/promo", label: "Промокоды", icon: TicketPercent },
  { to: "/admin/logs", label: "Логи", icon: ScrollText },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-surface">
      <div className="mx-auto max-w-[1400px] flex flex-col md:flex-row gap-4 p-3 md:p-4">
        <aside className="md:w-60 shrink-0">
          <div className="rounded-2xl bg-white border border-border/60 p-2 md:sticky md:top-20">
            <div className="px-3 py-2 mb-1 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-foreground/50 font-semibold">Админ</div>
                <div className="text-sm font-bold">BREEZE</div>
              </div>
              <Link to="/" className="text-foreground/50 hover:text-brand transition p-1.5 rounded-full hover:bg-surface" aria-label="На сайт">
                <Home className="h-4 w-4" />
              </Link>
            </div>
            <nav className="grid md:block gap-1 overflow-x-auto md:overflow-visible" style={{ gridTemplateColumns: "repeat(10, minmax(90px, 1fr))" }}>
              {nav.map((n) => {
                const Icon = n.icon;
                const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                      active ? "bg-brand text-brand-foreground shadow-sm" : "text-foreground/70 hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{n.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
