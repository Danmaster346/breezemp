// Сохранение предпочитаемого режима интерфейса (покупатель/продавец) за аккаунтом.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UiModeValue = "buyer" | "seller";

export const getPreferredMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ mode: UiModeValue }> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("preferred_mode").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const isSeller = (roles ?? []).some((r) => r.role === "seller");
    const stored = (profile?.preferred_mode ?? "buyer") as UiModeValue;
    return { mode: isSeller && stored === "seller" ? "seller" : "buyer" };
  });

export const setPreferredMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mode: UiModeValue }) => {
    if (input?.mode !== "buyer" && input?.mode !== "seller") {
      throw new Error("Недопустимый режим");
    }
    return { mode: input.mode };
  })
  .handler(async ({ data, context }): Promise<{ mode: UiModeValue }> => {
    const { supabase, userId } = context;

    let mode: UiModeValue = data.mode;
    if (mode === "seller") {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (!(roles ?? []).some((r) => r.role === "seller")) mode = "buyer";
    }

    const { error } = await supabase
      .from("profiles")
      .update({ preferred_mode: mode })
      .eq("id", userId);
    if (error) throw new Error("Не удалось сохранить режим");

    return { mode };
  });
