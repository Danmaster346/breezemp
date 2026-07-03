// Утилита форматирования цены в рублях из копеек
export function formatPrice(kopecks: number): string {
  // Переводим копейки в рубли
  const rubles = Math.round(kopecks / 100);
  // Разделяем разряды пробелами по русской типографике
  return rubles.toLocaleString("ru-RU") + " ₽";
}

// Парсим строку рублей в копейки (для формы товара)
export function rublesToKopecks(v: string | number): number {
  // Приводим к числу
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : v;
  // Умножаем на 100 и округляем
  return Math.round((isNaN(n) ? 0 : n) * 100);
}
