// Эмодзи-иконки категорий для плиток каталога.
// Ключи — slug категории; дополнительно поддерживаем поиск по названию.
export const CATEGORY_EMOJI: Record<string, string> = {
  auto: "🚗",
  accessories: "👜",
  appliances: "🏠",
  kids: "🧸",
  home: "🛋️",
  other: "📦",
  health: "💊",
  games: "🎮",
  tools: "🔧",
  stationery: "✏️",
  books: "📚",
  beauty: "💄",
  furniture: "🪑",
  obuv: "👟",
  shoes: "👟",
  clothing: "👕",
  food: "🛒",
  garden: "🌱",
  sport: "⚽",
  pets: "🐾",
  hobby: "🎨",
  electronics: "📱",
  jewelry: "💍",
};

const BY_NAME: Record<string, string> = {
  "авто": "🚗",
  "аксессуары": "👜",
  "бытовая техника": "🏠",
  "детям": "🧸",
  "дом": "🛋️",
  "другое": "📦",
  "здоровье": "💊",
  "игры и приставки": "🎮",
  "инструменты": "🔧",
  "канцелярия": "✏️",
  "книги": "📚",
  "красота": "💄",
  "мебель": "🪑",
  "обувь": "👟",
  "одежда": "👕",
  "продукты": "🛒",
  "сад и дача": "🌱",
  "спорт": "⚽",
  "товары для животных": "🐾",
  "хобби и творчество": "🎨",
  "электроника": "📱",
  "ювелирные изделия": "💍",
};

/** Эмодзи категории по slug (с фолбэком на название и 📦). */
export function getCategoryEmoji(
  slug?: string | null,
  name?: string | null,
): string {
  if (slug && CATEGORY_EMOJI[slug]) return CATEGORY_EMOJI[slug];
  if (name && BY_NAME[name.trim().toLowerCase()]) {
    return BY_NAME[name.trim().toLowerCase()];
  }
  return "📦";
}
