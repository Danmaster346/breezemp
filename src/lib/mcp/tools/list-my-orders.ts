import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseAsUser, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "list_my_orders",
  title: "Мои заказы",
  description: "Возвращает заказы вошедшего покупателя Kupiks с товарами и статусами.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).describe("Сколько заказов вернуть (1–50).").default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    try {
      requireAuth(ctx);
      const sb = supabaseAsUser(ctx);
      const { data, error } = await sb
        .from("orders")
        .select("id, created_at, status, total_kopecks, order_items(id, product_id, title, qty, price_kopecks, item_status)")
        .eq("buyer_id", ctx.getUserId())
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return errorResult(error.message);
      const items = (data ?? []).map((o) => ({
        ...o,
        total_rub: (o.total_kopecks ?? 0) / 100,
      }));
      return textResult(`Всего заказов: ${items.length}\n\n${JSON.stringify(items, null, 2)}`, { orders: items });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
