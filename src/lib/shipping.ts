// Способы доставки и логика расчёта стоимости
export type ShippingMethod = "pickup" | "cdek" | "yandex";

export interface ShippingOption {
  id: ShippingMethod;
  emoji: string;
  label: string;
  description: string;
  eta: string;
  baseKopecks: number; // базовая стоимость
  freeFromKopecks?: number; // бесплатно при заказе от N
  needsAddress: boolean;
  addressLabel: string;
  addressPlaceholder: string;
}

// Порог бесплатной доставки курьером — 3000 ₽
export const FREE_SHIPPING_FROM_KOPECKS = 300000;

export const SHIPPING_OPTIONS: ShippingOption[] = [
  {
    id: "cdek",
    emoji: "🚚",
    label: "Курьер",
    description: "Курьер привезёт заказ по указанному адресу",
    eta: "2–5 дней",
    baseKopecks: 30000,
    freeFromKopecks: FREE_SHIPPING_FROM_KOPECKS,
    needsAddress: true,
    addressLabel: "Адрес доставки",
    addressPlaceholder: "Улица, дом, квартира",
  },
  {
    id: "pickup",
    emoji: "📦",
    label: "Пункт выдачи",
    description: "Получите заказ в удобном пункте выдачи",
    eta: "3–7 дней",
    baseKopecks: 15000,
    needsAddress: true,
    addressLabel: "Адрес пункта выдачи",
    addressPlaceholder: "Город, улица, дом",
  },
  {
    id: "yandex",
    emoji: "📮",
    label: "Почта России",
    description: "Доставка в отделение Почты России",
    eta: "7–14 дней",
    baseKopecks: 20000,
    needsAddress: true,
    addressLabel: "Адрес отделения",
    addressPlaceholder: "Город, улица, дом, индекс",
  },
];

export const DEFAULT_SHIPPING_METHOD: ShippingMethod = "cdek";

export function getShippingOption(id: string): ShippingOption {
  return SHIPPING_OPTIONS.find((o) => o.id === id) ?? SHIPPING_OPTIONS[0];
}

export function calcShippingCost(id: string, subtotalKopecks: number): number {
  const opt = getShippingOption(id);
  if (opt.freeFromKopecks && subtotalKopecks >= opt.freeFromKopecks) return 0;
  return opt.baseKopecks;
}
