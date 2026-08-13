// Единые тост-уведомления Kupiks (sonner). Один стиль текстов на всё приложение.
import { toast } from "sonner";

/** 🛒 Товар добавлен в корзину + переход в корзину */
export function toastAddedToCart(title?: string, onGo?: () => void) {
  toast.success("🛒 Товар добавлен в корзину", {
    description: title,
    action: {
      label: "Перейти",
      onClick: () => {
        if (onGo) onGo();
        else if (typeof window !== "undefined") window.location.assign("/cart");
      },
    },
  });
}

/** Удаление из корзины с возможностью отмены в течение 5 секунд */
export function toastRemovedFromCart(title: string | undefined, undo: () => void) {
  toast("Удалено", {
    description: title,
    duration: 5000,
    action: { label: "Отменить", onClick: undo },
  });
}

/** ❤️ Избранное */
export function toastFavorite(favored: boolean) {
  if (favored) toast.success("❤️ Добавлено в избранное");
  else toast("Убрано из избранного");
}

/** 📡 Проблема с сетью */
export function toastNetworkError(description?: string) {
  toast.error("📡 Нет соединения. Проверьте интернет", { description, id: "network-offline" });
}

/** ✅ Заказ оформлен */
export function toastOrderPlaced(orderId: string) {
  toast.success(`✅ Заказ оформлен! Номер: #${orderId.slice(0, 8).toUpperCase()}`, {
    duration: 6000,
  });
}

/** 🔗 Ссылка скопирована */
export function toastLinkCopied() {
  toast.success("🔗 Ссылка скопирована");
}
