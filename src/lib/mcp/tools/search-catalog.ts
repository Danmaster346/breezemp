import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "search_catalog",
  title: "Поиск в каталоге",
  description: "Ищет активные и одобренные модерацией товары Kupiks по названию/описанию. Публично.",
  inputSchema: {
    query: z.string().describe("Поисковый запрос (пусто — популярные)."),
    limit: z.number().int().min(1).max(50).describe("Сколько товаров вернуть (1–50).").default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    try {
      const sb = supabaseAnon();
      let q = sb
        .from("products")
        .select("id, title, price_kopecks, image_url, stock, seller_id, rating_avg, review_count")
        .eq("is_active", true)
        .eq("moderation_status", "approved")
        .limit(limit);
      if (query.trim()) {
        const like = `%${query.trim()}%`;
        q = q.or(`title.ilike.${like},description.ilike.${like}`);
      } else {
        q = q.order("review_count", { ascending: false });
      }
      const { data, error } = await q;
      if (error) return errorResult(error.message);
      const items = (data ?? []).map((p) => ({
        ...p,
        price_rub: (p.price_kopecks ?? 0) / 100,
      }));
      return textResult(`Найдено: ${items.length}\n\n${JSON.stringify(items, null, 2)}`, { items });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
