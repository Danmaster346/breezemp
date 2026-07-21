import { defineTool } from "@lovable.dev/mcp-js";
import { requireAuth, supabaseAsUser, textResult, errorResult } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Кто я",
  description: "Возвращает профиль вошедшего пользователя Kupiks (id, email, имя, роли).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      requireAuth(ctx);
      const sb = supabaseAsUser(ctx);
      const userId = ctx.getUserId();
      const [{ data: profile }, { data: roles }] = await Promise.all([
        sb.from("profiles").select("id, full_name, email, phone").eq("id", userId).maybeSingle(),
        sb.from("user_roles").select("role").eq("user_id", userId),
      ]);
      const payload = {
        id: userId,
        email: ctx.getUserEmail() ?? profile?.email ?? null,
        full_name: profile?.full_name ?? null,
        roles: (roles ?? []).map((r) => r.role),
      };
      return textResult(JSON.stringify(payload, null, 2), payload);
    } catch (e) {
      return errorResult((e as Error).message);
    }
  },
});
