// Страница входа и регистрации с выбором роли
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { toast } from "sonner";

// Определяем маршрут «/auth»
export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Вход и регистрация — BreezeMarket" }] }),
  component: AuthPage,
});

// Компонент авторизации
function AuthPage() {
  const navigate = useNavigate();
  // Режим: вход или регистрация
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  // Поля формы
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [busy, setBusy] = useState(false);

  // Отправка формы
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        // Регистрация нового пользователя
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        // Записываем выбранную роль: покупатель — напрямую, продавец — через серверную функцию
        if (data.user) {
          if (role === "buyer") {
            await supabase.from("user_roles").insert({ user_id: data.user.id, role: "buyer" });
          } else {
            const { becomeSeller } = await import("@/lib/roles.functions");
            await becomeSeller();
          }
        }
        toast.success("Аккаунт создан!");
      } else {
        // Вход существующего пользователя
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("С возвращением!");
      }
      // Направляем в кабинет
      navigate({ to: "/account" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          {/* Переключатель режима */}
          <div className="flex gap-1 p-1 rounded-lg bg-secondary mb-6">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                mode === "signin" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                mode === "signup" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-sm text-muted-foreground">Имя</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full h-11 px-3 rounded-lg border bg-background"
                />
              </div>
            )}
            <div>
              <label className="text-sm text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-lg border bg-background"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Пароль</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-lg border bg-background"
              />
            </div>
            {mode === "signup" && (
              // Выбор роли только при регистрации
              <div>
                <label className="text-sm text-muted-foreground">Кто вы?</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("buyer")}
                    className={`p-3 rounded-lg border text-sm font-medium ${
                      role === "buyer"
                        ? "border-primary bg-accent text-accent-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    🛒 Покупаю
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("seller")}
                    className={`p-3 rounded-lg border text-sm font-medium ${
                      role === "seller"
                        ? "border-primary bg-accent text-accent-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    🏪 Продаю
                  </button>
                </div>
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Подождите..." : mode === "signin" ? "Войти" : "Создать аккаунт"}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
