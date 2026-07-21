import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseAsUser, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "list_my_products",
  title: "Мои товары (продавец)",
  description: "Возвращает товары вошедшего продавца Kupiks (все статусы модерации).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).describe("Сколько товаров вернуть (1–100).").default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    try {
      requireAuth(ctx);
      const sb = supabaseAsUser(ctx);
      const { data, error } = await sb
        .from("products")
        .select("id, title, price_kopecks, stock, is_active, moderation_status, created_at")
        .eq("seller_id", ctx.getUserId())
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return errorResult(error.message);
      const items = (data ?? []).map((p) => ({ ...p, price_rub: (p.price_kopecks ?? 0) / 100 }));
      return textResult(`Товаров: ${items.length}\n\n${JSON.stringify(items, null, 2)}`, { products: items });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
