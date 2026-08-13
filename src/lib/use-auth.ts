// Хук получения текущего пользователя и его ролей
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AuthState = {
  user: User | null;
  isSeller: boolean;
  isAdmin: boolean;
  loading: boolean;
  /** true пока роли пользователя ещё не загружены */
  rolesLoading: boolean;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let lastLoadedFor: string | null = null;

    const loadRoles = async (uid: string) => {
      if (lastLoadedFor === uid) return;
      lastLoadedFor = uid;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (cancelled) return;
      const roles = data?.map((r) => r.role) ?? [];
      setIsSeller(roles.includes("seller"));
      setIsAdmin(roles.includes("admin"));
      setRolesLoading(false);
    };

    // onAuthStateChange сразу выстрелит INITIAL_SESSION, что покроет случай при монтировании.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u) {
        loadRoles(u.id);
      } else {
        lastLoadedFor = null;
        setIsSeller(false);
        setIsAdmin(false);
        setRolesLoading(false);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, isSeller, isAdmin, loading, rolesLoading };
}
