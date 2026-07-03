// Хук получения текущего пользователя и его роли
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

// Тип состояния авторизации
export type AuthState = {
  user: User | null; // текущий пользователь
  isSeller: boolean; // является ли продавцом
  loading: boolean; // идёт ли загрузка
};

// Хук возвращает пользователя и его роль
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null); // храним пользователя
  const [isSeller, setIsSeller] = useState(false); // храним признак продавца
  const [loading, setLoading] = useState(true); // индикатор загрузки

  useEffect(() => {
    // Функция подгрузки роли продавца
    const loadRole = async (uid: string) => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      // Проверяем наличие роли seller
      setIsSeller(!!data?.some((r) => r.role === "seller"));
    };

    // Подписываемся на изменения авторизации первым делом
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadRole(session.user.id);
      else setIsSeller(false);
    });

    // Затем читаем текущую сессию
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadRole(data.session.user.id);
      setLoading(false);
    });

    // Отписываемся при размонтировании
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, isSeller, loading };
}
