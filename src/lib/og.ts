// Абсолютные URL для og:image с фолбэком на дефолтное изображение бренда.
export const SITE_URL = "https://kupiks-marketplace.ru";

/** Дефолтная картинка для соцсетей (лежит в public/). */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;

/**
 * Приводит путь/URL картинки к абсолютному https-URL.
 * Возвращает null, если значение непригодно (пустое, data:, blob:).
 */
export function toAbsoluteImageUrl(src?: string | null): string | null {
  if (!src) return null;
  const v = src.trim();
  if (!v || v.startsWith("data:") || v.startsWith("blob:")) return null;
  // Подписанные ссылки хранилища истекают — соцсети кэшируют превью и оно ломается
  if (v.includes("/object/sign/") || /[?&]token=/.test(v)) return null;
  if (/^https:\/\//i.test(v)) return v;
  // http → https, чтобы соцсети не отбрасывали небезопасный ресурс
  if (/^http:\/\//i.test(v)) return `https://${v.slice(7)}`;
  if (v.startsWith("//")) return `https:${v}`;
  return `${SITE_URL}${v.startsWith("/") ? v : `/${v}`}`;
}

/** Абсолютный og:image с гарантированным фолбэком. */
export function ogImageUrl(src?: string | null): string {
  return toAbsoluteImageUrl(src) ?? DEFAULT_OG_IMAGE;
}
