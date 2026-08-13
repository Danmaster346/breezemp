// Клиентское хранилище корзины на Zustand с сохранением в localStorage
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Тип позиции в корзине
export type CartItem = {
  id: string; // id товара
  title: string; // название товара
  price_kopecks: number; // цена в копейках
  image_url: string | null; // ссылка на изображение
  seller_id: string; // id продавца
  quantity: number; // количество
  stock: number; // доступный остаток
};

// Тип состояния корзины
type CartState = {
  items: CartItem[]; // список позиций
  add: (item: Omit<CartItem, "quantity">, qty?: number) => void; // добавить товар
  remove: (id: string) => void; // удалить товар
  setQty: (id: string, qty: number) => void; // изменить количество
  syncStock: (stockById: Record<string, number>) => void; // обновить остатки с сервера
  clear: () => void; // очистить корзину

  totalKopecks: () => number; // итоговая сумма в копейках
  totalCount: () => number; // общее число единиц
};

// Создаём стор с сохранением в localStorage
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [], // начальный пустой список
      add: (item, qty = 1) =>
        set((s) => {
          // Ищем позицию в корзине
          const existing = s.items.find((i) => i.id === item.id);
          if (existing) {
            // Увеличиваем количество, не превышая остаток
            const nextQty = Math.min(existing.quantity + qty, item.stock);
            return {
              items: s.items.map((i) =>
                i.id === item.id ? { ...i, quantity: nextQty } : i,
              ),
            };
          }
          // Иначе добавляем новую позицию
          return { items: [...s.items, { ...item, quantity: Math.min(qty, item.stock) }] };
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      setQty: (id, qty) =>
        set((s) => ({
          // Обновляем количество с ограничением остатком
          items: s.items.map((i) =>
            i.id === id ? { ...i, quantity: Math.max(1, Math.min(qty, i.stock)) } : i,
          ),
        })),
      // Обновляем остатки по данным сервера и подрезаем количество
      syncStock: (stockById) =>
        set((s) => ({
          items: s.items.map((i) => {
            const stock = stockById[i.id];
            if (typeof stock !== "number") return i;
            return { ...i, stock, quantity: Math.max(1, Math.min(i.quantity, Math.max(stock, 1))) };
          }),
        })),
      clear: () => set({ items: [] }),

      // Считаем сумму по всем позициям
      totalKopecks: () => get().items.reduce((s, i) => s + i.price_kopecks * i.quantity, 0),
      // Считаем количество единиц
      totalCount: () => get().items.reduce((s, i) => s + i.quantity, 0),
    }),
    { name: "breeze-cart-v1" }, // ключ localStorage
  ),
);
