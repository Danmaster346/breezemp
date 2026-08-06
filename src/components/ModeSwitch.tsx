// Индикатор и переключатель режима интерфейса: покупатель / продавец.
// Десктоп — сегмент-тумблер, мобильный — бейдж + нижняя панель выбора.
import { Link } from "@tanstack/react-router";
import { Store, ShoppingBag, Check } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import type { UiMode } from "@/lib/mode-store";

type Props = {
  mode: UiMode;
  isSeller: boolean;
  onSelect: (m: UiMode) => void;
};

/** Сегмент-тумблер для десктопа (виден с md). */
export function ModeSegmented({ mode, isSeller, onSelect }: Props) {
  if (!isSeller) return null;
  const seller = mode === "seller";
  return (
    <div className="hidden md:inline-flex items-center rounded-full bg-surface p-0.5 text-xs font-semibold ring-1 ring-border">
      <button
        type="button"
        onClick={() => onSelect("buyer")}
        aria-pressed={!seller}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full ui-transition ${
          !seller
            ? "bg-brand text-brand-foreground shadow-sm"
            : "text-foreground/60 hover:text-foreground"
        }`}
      >
        <ShoppingBag className="h-3.5 w-3.5" />
        Покупатель
      </button>
      <button
        type="button"
        onClick={() => onSelect("seller")}
        aria-pressed={seller}
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full ui-transition ${
          seller
            ? "bg-brand text-brand-foreground shadow-sm"
            : "text-foreground/60 hover:text-foreground"
        }`}
      >
        <Store className="h-3.5 w-3.5" />
        Продавец
      </button>
    </div>
  );
}

/** Бейдж текущего режима + шит выбора (все экраны, основное — мобильный). */
export function ModeBadge({ mode, isSeller, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const seller = mode === "seller";
  const Icon = seller ? Store : ShoppingBag;

  const pick = (m: UiMode) => {
    setOpen(false);
    onSelect(m);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Режим интерфейса"
        className={`md:hidden inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[11px] font-bold ui-transition ${
          seller
            ? "bg-brand text-brand-foreground"
            : "bg-surface text-foreground ring-1 ring-border"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {seller ? "Продавец" : "Покупатель"}
      </button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Режим интерфейса"
        description="Выберите, как пользоваться Kupiks"
      >
        <div className="space-y-2 pb-2">
          <button
            type="button"
            onClick={() => pick("buyer")}
            className={`w-full flex items-center gap-3 rounded-2xl p-4 text-left ui-transition ${
              !seller ? "bg-surface-strong ring-2 ring-brand" : "bg-surface"
            }`}
          >
            <span className="h-10 w-10 rounded-full bg-background flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-brand" />
            </span>
            <span className="flex-1">
              <span className="block font-bold">Я покупаю</span>
              <span className="block text-xs text-muted-foreground">
                Каталог, корзина, заказы
              </span>
            </span>
            {!seller && <Check className="h-5 w-5 text-brand" />}
          </button>

          {isSeller ? (
            <button
              type="button"
              onClick={() => pick("seller")}
              className={`w-full flex items-center gap-3 rounded-2xl p-4 text-left ui-transition ${
                seller ? "bg-surface-strong ring-2 ring-brand" : "bg-surface"
              }`}
            >
              <span className="h-10 w-10 rounded-full bg-background flex items-center justify-center">
                <Store className="h-5 w-5 text-brand" />
              </span>
              <span className="flex-1">
                <span className="block font-bold">Я продаю</span>
                <span className="block text-xs text-muted-foreground">
                  Товары, заказы, баланс
                </span>
              </span>
              {seller && <Check className="h-5 w-5 text-brand" />}
            </button>
          ) : (
            <Link
              to="/auth"
              search={{ as: "seller", mode: "signup" } as never}
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-3 rounded-2xl p-4 bg-surface ui-transition"
            >
              <span className="h-10 w-10 rounded-full bg-background flex items-center justify-center">
                <Store className="h-5 w-5 text-brand" />
              </span>
              <span className="flex-1">
                <span className="block font-bold">Начать продавать</span>
                <span className="block text-xs text-muted-foreground">
                  Регистрация продавца
                </span>
              </span>
            </Link>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
