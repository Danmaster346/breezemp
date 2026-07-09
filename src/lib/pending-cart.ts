// Ожидающее действие «добавить в корзину» для гостей + глобальный диалог входа
import { create } from "zustand";

const KEY = "breeze-pending-add-v1";

export type PendingAdd = { productId: string; qty: number };

export function setPendingAdd(p: PendingAdd) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function consumePendingAdd(): PendingAdd | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as PendingAdd;
  } catch {
    return null;
  }
}

type DialogState = {
  open: boolean;
  message: string;
  redirectTo: string | null;
  show: (opts?: { message?: string; redirectTo?: string }) => void;
  hide: () => void;
};

const DEFAULT_MSG =
  "Чтобы добавить товар в корзину, войдите в аккаунт или зарегистрируйтесь.";

// Zustand-стор для управления модалкой «нужно войти»
export const useSignInDialog = create<DialogState>((set) => ({
  open: false,
  message: DEFAULT_MSG,
  redirectTo: null,
  show: (opts) =>
    set({
      open: true,
      message: opts?.message ?? DEFAULT_MSG,
      redirectTo: opts?.redirectTo ?? null,
    }),
  hide: () => set({ open: false }),
}));
