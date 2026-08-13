import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("platform_settings").select("key, value");
    if (error) throw new Error(error.message);
    const result: Record<string, string> = {};
    for (const row of data ?? []) result[row.key] = row.value;
    return result;
  });

export const updatePlatformSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; value: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("platform_settings").upsert(
      { key: data.key, value: data.value, updated_at: new Date().toISOString(), updated_by: context.userId },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    await logAction(context.userId, "settings.update", "platform_settings", data.key, { value: data.value });
    return { ok: true };
  });

export const getPublicSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const SUPABASE_URL = process.env['SUPABASE_URL'];
  const SUPABASE_PUBLISHABLE_KEY = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
  }
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers) {
          new Headers(init.headers).forEach((value, key) => headers.set(key, value));
        }
        if (SUPABASE_PUBLISHABLE_KEY.startsWith("sb_")) {
          headers.delete("Authorization");
        }
        headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const keys = ["maintenance_mode", "maintenance_message", "support_email", "support_phone", "support_tg"];
  const { data, error } = await client.from("platform_settings").select("key, value").in("key", keys);
  if (error) throw new Error(error.message);
  const result: Record<string, string> = {};
  for (const row of data ?? []) result[row.key] = row.value;
  return result;
});
