// Избранное покупателя: список / переключение / проверка
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FavoriteItem = {
  id: string;
  title: string;
  price_kopecks: number;
  image_url: string | null;
  stock: number;
  seller_id: string;
  seller_name: string;
  added_at: string;
};

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FavoriteItem[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: favs, error } = await supabaseAdmin
      .from("favorites")
      .select("product_id, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = favs ?? [];
    if (list.length === 0) return [];

    const ids = list.map((f) => f.product_id);
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, title, price_kopecks, image_url, stock, seller_id")
      .in("id", ids);

    const sellerIds = Array.from(new Set((products ?? []).map((p) => p.seller_id)));
    const [{ data: profs }, { data: shops }] = await Promise.all([
      sellerIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name").in("id", sellerIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      sellerIds.length
        ? supabaseAdmin.from("seller_profiles").select("user_id, shop_name").in("user_id", sellerIds)
        : Promise.resolve({ data: [] as { user_id: string; shop_name: string | null }[] }),
    ]);
    const nameMap = new Map<string, string>();
    for (const p of profs ?? []) if (p.full_name?.trim()) nameMap.set(p.id, p.full_name.trim());
    for (const s of shops ?? []) if (s.shop_name?.trim()) nameMap.set(s.user_id, s.shop_name.trim());

    const productMap = new Map((products ?? []).map((p) => [p.id, p]));
    return list
      .map((f) => {
        const p = productMap.get(f.product_id);
        if (!p) return null;
        return {
          id: p.id,
          title: p.title,
          price_kopecks: p.price_kopecks,
          image_url: p.image_url,
          stock: p.stock,
          seller_id: p.seller_id,
          seller_name: nameMap.get(p.seller_id) ?? "Магазин",
          added_at: f.created_at,
        } as FavoriteItem;
      })
      .filter((x): x is FavoriteItem => x !== null);
  });

export const listFavoriteIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await context.supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.product_id as string);
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ favored: boolean }> => {
    const { data: existing } = await context.supabase
      .from("favorites")
      .select("id")
      .eq("user_id", context.userId)
      .eq("product_id", data.product_id)
      .maybeSingle();
    if (existing) {
      const { error } = await context.supabase
        .from("favorites")
        .delete()
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { favored: false };
    }
    const { error } = await context.supabase
      .from("favorites")
      .insert({ user_id: context.userId, product_id: data.product_id });
    if (error) throw new Error(error.message);
    return { favored: true };
  });
