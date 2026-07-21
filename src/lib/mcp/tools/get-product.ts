import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "get_product",
  title: "Получить товар",
  description: "Возвращает подробности товара Kupiks по идентификатору. Публично.",
  inputSchema: {
    id: z.string().uuid().describe("UUID товара."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }) => {
    try {
      const sb = supabaseAnon();
      const { data, error } = await sb
        .from("products")
        .select("*")
        .eq("id", id)
        .eq("is_active", true)
        .eq("moderation_status", "approved")
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult("Товар не найден или недоступен.");
      const payload = { ...data, price_rub: (data.price_kopecks ?? 0) / 100 };
      return textResult(JSON.stringify(payload, null, 2), payload);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
