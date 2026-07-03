// Пути-обёртка «_authenticated»: сюда попадают только авторизованные пользователи
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Маршрут-обёртка проверяет сессию через getUser и перенаправляет на /auth при её отсутствии
export const Route = createFileRoute("/_authenticated")({
  ssr: false, // сессия хранится в localStorage браузера, SSR отключаем
  beforeLoad: async () => {
    // Проверяем текущего пользователя
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Прокидываем пользователя в контекст (по желанию)
    return { user: data.user };
  },
  component: () => <Outlet />,
});
