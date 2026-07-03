// Способы доставки и логика расчёта стоимости
export type ShippingMethod = "pickup" | "cdek" | "yandex";

export interface ShippingOption {
  id: ShippingMethod;
  label: string;
  description: string;
  eta: string;
  baseKopecks: number; // базовая стоимость
  freeFromKopecks?: number; // бесплатно при заказе от N
  needsAddress: boolean;
  addressLabel: string;
  addressPlaceholder: string;
}

export const SHIPPING_OPTIONS: ShippingOption[] = [
  {
    id: "pickup",
    label: "Самовывоз / ПВЗ",
    description: "Забрать из ближайшего пункта выдачи",
    eta: "1–2 дня",
    baseKopecks: 0,
    needsAddress: true,
    addressLabel: "Адрес пункта выдачи",
    addressPlaceholder: "Город, адрес ПВЗ",
  },
  {
    id: "cdek",
    label: "СДЭК до двери",
    description: "Курьер СДЭК привезёт по адресу",
    eta: "2–5 дней",
    baseKopecks: 39900,
    freeFromKopecks: 500000,
    needsAddress: true,
    addressLabel: "Адрес доставки",
    addressPlaceholder: "Город, улица, дом, квартира, индекс",
  },
  {
    id: "yandex",
    label: "Яндекс Доставка",
    description: "Быстрая доставка курьером",
    eta: "1–3 дня",
    baseKopecks: 49900,
    freeFromKopecks: 700000,
    needsAddress: true,
    addressLabel: "Адрес доставки",
    addressPlaceholder: "Город, улица, дом, квартира, индекс",
  },
];

export function getShippingOption(id: string): ShippingOption {
  return SHIPPING_OPTIONS.find((o) => o.id === id) ?? SHIPPING_OPTIONS[0];
}

export function calcShippingCost(id: string, subtotalKopecks: number): number {
  const opt = getShippingOption(id);
  if (opt.freeFromKopecks && subtotalKopecks >= opt.freeFromKopecks) return 0;
  return opt.baseKopecks;
}
