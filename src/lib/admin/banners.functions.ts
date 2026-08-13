// Серверные функции для управления баннерами главной страницы
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type BannerRow = {
  id: string;
  title: string;
  subtitle: string | null;
  promo_code: string | null;
  link: string | null;
  bg_color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const listBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, supabaseAdmin } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("banners")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as BannerRow[];
  });

export const upsertBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    title: string;
    subtitle?: string | null;
    promo_code?: string | null;
    link?: string | null;
    bg_color?: string;
    is_active?: boolean;
    sort_order?: number;
  }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const payload = {
      title: data.title.trim(),
      subtitle: data.subtitle?.trim() || null,
      promo_code: data.promo_code?.trim() || null,
      link: data.link?.trim() || null,
      bg_color: data.bg_color ?? "#ff6b35",
      is_active: data.is_active ?? true,
      sort_order: data.sort_order ?? 0,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("banners").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAction(context.userId, "banner.update", "banner", data.id, payload);
      return { ok: true, id: data.id };
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("banners")
        .insert(payload)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      await logAction(context.userId, "banner.create", "banner", created?.id ?? null, payload);
      return { ok: true, id: created?.id };
    }
  });

export const deleteBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAction(context.userId, "banner.delete", "banner", data.id, {});
    return { ok: true };
  });

export const reorderBanners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderedIds: string[] }) => d)
  .handler(async ({ context, data }) => {
    const { assertAdmin, supabaseAdmin, logAction } = await import("./admin-helpers.server");
    await assertAdmin(context.userId);
    for (let i = 0; i < data.orderedIds.length; i++) {
      const { error } = await supabaseAdmin
        .from("banners")
        .update({ sort_order: i })
        .eq("id", data.orderedIds[i]);
      if (error) throw new Error(error.message);
    }
    await logAction(context.userId, "banner.reorder", "banner", null, { orderedIds: data.orderedIds });
    return { ok: true };
  });

export type PublicBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  promo_code: string | null;
  link: string | null;
  bg_color: string;
};

// Публичное чтение активных баннеров для главной страницы (без авторизации)
export const listPublicBanners = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const supa = createClient<Database>(url, key, {
    auth: { persistSession: false },
    global: key.startsWith("sb_")
      ? {
          fetch: (input, init) => {
            const headers = new Headers(init?.headers);
            headers.delete("Authorization");
            headers.set("apikey", key);
            return fetch(input, { ...init, headers });
          },
        }
      : undefined,
  });

  const { data, error } = await supa
    .from("banners")
    .select("id, title, subtitle, promo_code, link, bg_color")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicBanner[];
});
