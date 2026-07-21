// Общие хелперы для инструментов MCP. Читают env внутри функций,
// чтобы entry-модуль был безопасен для build-time eval и cold-start.
import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

function ensureEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

// Клиент от имени вошедшего пользователя — RLS применяется как для него.
export function supabaseAsUser(ctx: ToolContext) {
  const url = ensureEnv("SUPABASE_URL");
  const key = ensureEnv("SUPABASE_PUBLISHABLE_KEY");
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Публичный клиент (анонимный) для инструментов без авторизации.
// Opaque sb_ ключи не JWT — снимаем Authorization, шлём только apikey.
export function supabaseAnon() {
  const url = ensureEnv("SUPABASE_URL");
  const key = ensureEnv("SUPABASE_PUBLISHABLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export function textResult(text: string, structured?: unknown) {
  return {
    content: [{ type: "text" as const, text }],
    ...(structured !== undefined ? { structuredContent: structured as Record<string, unknown> } : {}),
  };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

export function requireAuth(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) {
    throw new Error("Требуется авторизация");
  }
}
