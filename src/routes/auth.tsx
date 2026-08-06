// Страница входа и регистрации с чётким выбором роли (покупатель/продавец)
// Параметры: mode=signin|signup, redirect=<path>, as=buyer|seller
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { useCart } from "@/lib/cart-store";
import { useMode } from "@/lib/mode-store";
import { consumePendingAdd } from "@/lib/pending-cart";
import { toast } from "sonner";
import { ShoppingBag, Store } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  redirect: z.string().startsWith("/").optional(),
  as: z.enum(["buyer", "seller"]).optional(),
});

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Вход и регистрация — Kupiks" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

// Подхватываем отложенный товар в корзину после входа
async function fulfillPendingAdd(): Promise<string | null> {
  const pending = consumePendingAdd();
  if (!pending) return null;
  const { data, error } = await supabase
    .from("products")
    .select("id, title, price_kopecks, image_url, seller_id, stock")
    .eq("id", pending.productId)
    .maybeSingle();
  if (error || !data) return null;
  useCart.getState().add(
    {
      id: data.id,
      title: data.title,
      price_kopecks: data.price_kopecks,
      image_url: data.image_url,
      seller_id: data.seller_id,
      stock: data.stock,
    },
    pending.qty,
  );
  toast.success(`«${data.title}» добавлен в корзину`);
  return data.id;
}

// Проверяем, есть ли у пользователя роль продавца
async function userHasSellerRole(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "seller")
    .maybeSingle();
  return !!data;
}

function AuthPage() {

  const search = Route.useSearch();
  const setMode = useMode((s) => s.setMode);

  const [mode, setModeLocal] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [role, setRole] = useState<"buyer" | "seller">(search.as ?? "buyer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (search.mode) setModeLocal(search.mode);
  }, [search.mode]);
  useEffect(() => {
    if (search.as) setRole(search.as);
  }, [search.as]);

  const isSeller = role === "seller";
  const accent = isSeller
    ? { badge: "bg-brand text-brand-foreground", ring: "ring-brand", btn: "bg-brand hover:bg-brand-strong text-brand-foreground", label: "Продавец", icon: Store }
    : { badge: "bg-foreground text-white", ring: "ring-foreground", btn: "bg-foreground hover:bg-foreground/90 text-white", label: "Покупатель", icon: ShoppingBag };
  const AccentIcon = accent.icon;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !agreedPrivacy) {
      toast.error("Подтвердите согласие с Политикой конфиденциальности");
      return;
    }
    setBusy(true);
    try {
      let userId: string | undefined;

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        userId = data.user?.id;
        if (userId) {
          if (role === "buyer") {
            await supabase.from("user_roles").insert({ user_id: userId, role: "buyer" });
          } else {
            const { becomeSeller } = await import("@/lib/roles.functions");
            await becomeSeller();
          }
        }
        toast.success(role === "seller" ? "Аккаунт продавца создан!" : "Аккаунт покупателя создан!");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        userId = data.user?.id;

        // Если пользователь выбрал вход как продавец — проверяем наличие роли
        if (role === "seller" && userId) {
          const hasSeller = await userHasSellerRole(userId);
          if (!hasSeller) {
            toast.error("У этого аккаунта нет роли продавца. Войдите как покупатель или зарегистрируйтесь как продавец.");
            setBusy(false);
            return;
          }
        }
        toast.success(role === "seller" ? "Вход в кабинет продавца" : "С возвращением!");
      }

      await fulfillPendingAdd();

      // Устанавливаем режим интерфейса согласно выбору
      setMode(role);

      // Жёсткий редирект: гарантированно перечитывает сессию из localStorage
      // и не даёт _authenticated beforeLoad сработать до её установки.
      if (role === "seller") {
        window.location.assign("/seller/products");
      } else {
        const redirectTo = search.redirect ?? "/account";
        window.location.assign(redirectTo);
      }
    } catch (err) {
      const e = err as { message?: string; status?: number; name?: string; code?: string };
      console.error("[auth] submit failed", err);
      const detail = [e?.status && `HTTP ${e.status}`, e?.code, e?.name].filter(Boolean).join(" · ");
      toast.error(e?.message || "Не удалось выполнить вход", {
        description: detail || undefined,
      });
    } finally {
      setBusy(false);
    }
  };


  return (
    <AppLayout>
      <div className="mx-auto max-w-md px-4 py-8 md:py-10">
        {/* Крупный переключатель ролей — сразу понятно, куда входишь */}
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 text-center">
            Как вы хотите {mode === "signin" ? "войти" : "зарегистрироваться"}?
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole("buyer")}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition ${
                role === "buyer"
                  ? "border-foreground bg-foreground text-white shadow-sm"
                  : "border-border bg-card hover:border-foreground/40"
              }`}
            >
              <ShoppingBag className="h-6 w-6" />
              <span className="text-sm font-semibold">Покупатель</span>
              <span className={`text-[11px] ${role === "buyer" ? "text-white/70" : "text-muted-foreground"}`}>
                Покупаю товары
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRole("seller")}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition ${
                role === "seller"
                  ? "border-brand bg-brand text-brand-foreground shadow-sm"
                  : "border-border bg-card hover:border-brand/40"
              }`}
            >
              <Store className="h-6 w-6" />
              <span className="text-sm font-semibold">Продавец</span>
              <span className={`text-[11px] ${role === "seller" ? "text-brand-foreground/80" : "text-muted-foreground"}`}>
                Продаю на Kupiks
              </span>
            </button>
          </div>
        </div>

        <div className={`rounded-2xl border-2 bg-card p-6 shadow-sm ring-1 ${isSeller ? "border-brand/30 ring-brand/10" : "border-foreground/20 ring-foreground/5"}`}>
          {/* Плашка выбранной роли */}
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide mb-4 ${accent.badge}`}>
            <AccentIcon className="h-3.5 w-3.5" />
            {mode === "signin" ? "Вход" : "Регистрация"}: {accent.label}
          </div>

          {search.redirect && (
            <div className="mb-4 rounded-xl border border-brand/20 bg-brand-soft px-3 py-2.5 text-xs text-foreground/80 text-center">
              Войдите, чтобы продолжить оформление
            </div>
          )}

          <div className="flex gap-1 p-1 rounded-lg bg-secondary mb-6">
            <button
              type="button"
              onClick={() => setModeLocal("signin")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
                mode === "signin" ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => setModeLocal("signup")}
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
                <label className="text-sm text-muted-foreground">
                  {isSeller ? "Название магазина или ваше имя" : "Имя"}
                </label>
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
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedPrivacy}
                  onChange={(e) => setAgreedPrivacy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-brand shrink-0"
                />
                <span>
                  Я соглашаюсь с{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline font-medium"
                  >
                    Политикой конфиденциальности
                  </a>{" "}
                  и обработкой персональных данных.
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={busy || (mode === "signup" && !agreedPrivacy)}
              className={`w-full rounded-xl py-3 font-semibold transition disabled:opacity-50 ${accent.btn}`}
            >
              {busy
                ? "Подождите..."
                : mode === "signin"
                  ? `Войти как ${accent.label.toLowerCase()}`
                  : `Создать аккаунт ${isSeller ? "продавца" : "покупателя"}`}
            </button>
          </form>

          {mode === "signin" && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {isSeller
                ? "Вход только для аккаунтов с ролью продавца"
                : "Продавец? Переключитесь наверху страницы"}
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
