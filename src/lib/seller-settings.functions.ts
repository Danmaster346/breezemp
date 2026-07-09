// Настройки магазина продавца: чтение и сохранение своей записи в seller_profiles.
// Логотип хранится приватно, для отображения формируем signed URL на 1 год.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SellerSettings = {
  shop_name: string;
  logo_path: string | null;
  logo_url: string | null;
  short_description: string;
  full_description: string;
  phone: string;
  email: string;
  whatsapp: string;
  telegram: string;
  instagram: string;
  vk: string;
  other_social: string;
  badges: string[];
};

const SIGNED_TTL = 60 * 60 * 24 * 365; // 1 год

async function signLogo(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from("store-logos")
    .createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}

function empty(): SellerSettings {
  return {
    shop_name: "",
    logo_path: null,
    logo_url: null,
    short_description: "",
    full_description: "",
    phone: "",
    email: "",
    whatsapp: "",
    telegram: "",
    instagram: "",
    vk: "",
    other_social: "",
    badges: [],
  };
}

function toSettings(row: Record<string, unknown> | null, logoUrl: string | null): SellerSettings {
  if (!row) return empty();
  const s = row as {
    shop_name: string | null;
    logo_path: string | null;
    short_description: string | null;
    full_description: string | null;
    phone: string | null;
    email: string | null;
    whatsapp: string | null;
    telegram: string | null;
    instagram: string | null;
    vk: string | null;
    other_social: string | null;
    badges: string[] | null;
  };
  return {
    shop_name: s.shop_name ?? "",
    logo_path: s.logo_path,
    logo_url: logoUrl,
    short_description: s.short_description ?? "",
    full_description: s.full_description ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    whatsapp: s.whatsapp ?? "",
    telegram: s.telegram ?? "",
    instagram: s.instagram ?? "",
    vk: s.vk ?? "",
    other_social: s.other_social ?? "",
    badges: s.badges ?? [],
  };
}

export const getMySellerSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SellerSettings & { fallbackName: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: row }, { data: profile }] = await Promise.all([
      supabaseAdmin.from("seller_profiles").select("*").eq("user_id", context.userId).maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle(),
    ]);
    const logoUrl = await signLogo(row?.logo_path ?? null);
    return {
      ...toSettings(row as Record<string, unknown> | null, logoUrl),
      fallbackName: profile?.full_name?.trim() || "",
    };
  });

const updateSchema = z.object({
  shop_name: z.string().trim().min(1, "Укажите название магазина").max(80),
  logo_path: z.string().max(300).nullable(),
  short_description: z.string().max(300).default(""),
  full_description: z.string().max(4000).default(""),
  phone: z.string().max(40).default(""),
  email: z.string().max(120).default(""),
  whatsapp: z.string().max(80).default(""),
  telegram: z.string().max(80).default(""),
  instagram: z.string().max(80).default(""),
  vk: z.string().max(120).default(""),
  other_social: z.string().max(200).default(""),
});

export const updateSellerSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateSchema.parse(d))
  .handler(async ({ data, context }): Promise<SellerSettings> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Если поменяли логотип — старые файлы этого продавца удаляем,
    // чтобы не оставалось мусора.
    const { data: prev } = await supabaseAdmin
      .from("seller_profiles")
      .select("logo_path")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (prev?.logo_path && prev.logo_path !== data.logo_path) {
      await supabaseAdmin.storage.from("store-logos").remove([prev.logo_path]);
    }

    const payload = {
      user_id: context.userId,
      shop_name: data.shop_name.trim(),
      logo_path: data.logo_path,
      short_description: data.short_description.trim(),
      full_description: data.full_description.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      whatsapp: data.whatsapp.trim(),
      telegram: data.telegram.trim(),
      instagram: data.instagram.trim(),
      vk: data.vk.trim(),
      other_social: data.other_social.trim(),
    };

    const { data: row, error } = await supabaseAdmin
      .from("seller_profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Имя магазина хранится ТОЛЬКО в seller_profiles.shop_name.
    // profiles.full_name — это личное имя покупателя; его перезаписывать нельзя,
    // иначе испортятся отзывы и данные доставки.


    const logoUrl = await signLogo(row?.logo_path ?? null);
    return toSettings(row as Record<string, unknown> | null, logoUrl);
  });

export const deleteMyLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("seller_profiles")
      .select("logo_path")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (prev?.logo_path) {
      await supabaseAdmin.storage.from("store-logos").remove([prev.logo_path]);
    }
    await supabaseAdmin
      .from("seller_profiles")
      .update({ logo_path: null })
      .eq("user_id", context.userId);
    return { ok: true };
  });

// Расширенная статистика магазина (для страницы настроек и публичной карточки)
export const getMyShopStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return computeShopStats(context.userId);
  });

export async function computeShopStats(sellerId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ count: productsCount }, { data: items }] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", sellerId)
      .eq("is_active", true),
    supabaseAdmin
      .from("order_items")
      .select("order_id, status")
      .eq("seller_id", sellerId),
  ]);

  const orderIds = new Set<string>();
  let delivered = 0;
  let finished = 0;
  for (const it of items ?? []) {
    orderIds.add((it as { order_id: string }).order_id);
    const st = (it as { status: string }).status;
    if (st === "received" || st === "delivered") {
      delivered += 1;
      finished += 1;
    } else if (st === "returned" || st === "cancelled") {
      finished += 1;
    }
  }

  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id")
    .eq("seller_id", sellerId);
  const productIds = (products ?? []).map((p) => (p as { id: string }).id);
  let reviewsCount = 0;
  let avgRating = 0;
  if (productIds.length > 0) {
    const { data: reviews } = await supabaseAdmin
      .from("reviews")
      .select("rating")
      .in("product_id", productIds);
    reviewsCount = reviews?.length ?? 0;
    if (reviewsCount > 0) {
      avgRating =
        (reviews ?? []).reduce((s, r) => s + (r as { rating: number }).rating, 0) /
        reviewsCount;
    }
  }

  const deliveredRate = finished > 0 ? Math.round((delivered / finished) * 100) : 0;

  return {
    productsCount: productsCount ?? 0,
    ordersCount: orderIds.size,
    reviewsCount,
    avgRating,
    deliveredRate,
  };
}

// Автоматически рассчитываемые бейджи (используем и для превью, и для публичной страницы)
export function computeAutoBadges(input: {
  ordersCount: number;
  avgRating: number;
  deliveredRate: number;
}): string[] {
  const badges: string[] = [];
  if (input.avgRating >= 4.7 && input.ordersCount >= 5) badges.push("Высокий рейтинг");
  if (input.ordersCount >= 50) badges.push("Много заказов");
  if (input.deliveredRate >= 95 && input.ordersCount >= 10) badges.push("Быстрая отправка");
  if (input.ordersCount >= 20 && input.avgRating >= 4.5) badges.push("Надёжный продавец");
  return badges;
}
