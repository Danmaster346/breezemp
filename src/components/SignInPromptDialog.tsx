// Глобальная модалка: предложение войти или зарегистрироваться
import { useNavigate } from "@tanstack/react-router";
import { LogIn, UserPlus, ShoppingBag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSignInDialog } from "@/lib/pending-cart";

export function SignInPromptDialog() {
  const open = useSignInDialog((s) => s.open);
  const message = useSignInDialog((s) => s.message);
  const redirectTo = useSignInDialog((s) => s.redirectTo);
  const hide = useSignInDialog((s) => s.hide);
  const navigate = useNavigate();

  const go = (mode: "signin" | "signup") => {
    hide();
    navigate({
      to: "/auth",
      search: { mode, redirect: redirectTo ?? undefined },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? hide() : null)}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-brand-soft">
            <ShoppingBag className="h-6 w-6 text-brand" />
          </div>
          <DialogTitle className="text-xl">Нужен аккаунт</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {message}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={() => go("signin")}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 shadow-sm transition"
          >
            <LogIn className="h-4 w-4" /> Войти
          </button>
          <button
            type="button"
            onClick={() => go("signup")}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-brand/40 bg-white px-6 py-3 text-sm font-semibold text-brand hover:bg-brand-soft transition"
          >
            <UserPlus className="h-4 w-4" /> Зарегистрироваться
          </button>
          <button
            type="button"
            onClick={hide}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground transition"
          >
            Продолжить как гость
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
