// Хранилище активного режима интерфейса: покупатель/продавец.
// Значение сохраняется в localStorage, чтобы режим не сбрасывался при перезагрузке.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UiMode = "buyer" | "seller";

interface ModeState {
  mode: UiMode;
  setMode: (m: UiMode) => void;
  toggle: () => void;
}

export const useMode = create<ModeState>()(
  persist(
    (set, get) => ({
      mode: "buyer",
      setMode: (m) => set({ mode: m }),
      toggle: () => set({ mode: get().mode === "buyer" ? "seller" : "buyer" }),
    }),
    { name: "breeze-ui-mode" },
  ),
);
