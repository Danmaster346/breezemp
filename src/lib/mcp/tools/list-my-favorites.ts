import { defineTool } from "@lovable.dev/mcp-js";
import { requireAuth, supabaseAsUser, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "list_my_favorites",
  title: "Моё избранное",
  description: "Возвращает избранные товары вошедшего пользователя Kupiks.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      requireAuth(ctx);
      const sb = supabaseAsUser(ctx);
      const { data, error } = await sb
        .from("favorites")
        .select("product_id, created_at, products(id, title, price_kopecks, image_url, stock)")
        .eq("user_id", ctx.getUserId())
        .order("created_at", { ascending: false });
      if (error) return errorResult(error.message);
      return textResult(`Избранного: ${(data ?? []).length}\n\n${JSON.stringify(data, null, 2)}`, { favorites: data });
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
