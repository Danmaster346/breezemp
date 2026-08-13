// Недавно просмотренные товары — хранение последних 8 id в localStorage
const KEY = "kupiks:recently-viewed";
const LIMIT = 8;

export function getRecentlyViewed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecentlyViewed(id: string): string[] {
  if (typeof window === "undefined") return [];
  const next = [id, ...getRecentlyViewed().filter((v) => v !== id)].slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // приватный режим — игнорируем
  }
  return next;
}
