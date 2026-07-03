// Публичная карточка продавца: имя магазина, агрегаты (рейтинг, товары, отзывы)
// и список активных товаров. Данные читаем через supabaseAdmin, но отдаём только
// безопасные поля (без телефона и служебной информации из profiles).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SellerPublicProduct = {
  id: string;
  title: string;
  price_kopecks: number;
  image_url: string | null;
  stock: number;
};

export type SellerPublicProfile = {
  id: string;
  name: string;
  productsCount: number;
  reviewsCount: number;
  avgRating: number;
  products: SellerPublicProduct[];
};

export const getSellerProfile = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<SellerPublicProfile | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("id", data.id)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (!profile) return null;

    const { data: products, error: productsErr } = await supabaseAdmin
      .from("products")
      .select("id, title, price_kopecks, image_url, stock")
      .eq("seller_id", data.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (productsErr) throw new Error(productsErr.message);

    const productIds = (products ?? []).map((p) => p.id);
    let avgRating = 0;
    let reviewsCount = 0;
    if (productIds.length > 0) {
      const { data: reviews, error: reviewsErr } = await supabaseAdmin
        .from("reviews")
        .select("rating")
        .in("product_id", productIds);
      if (reviewsErr) throw new Error(reviewsErr.message);
      reviewsCount = reviews?.length ?? 0;
      if (reviewsCount > 0) {
        avgRating =
          (reviews ?? []).reduce((s, r) => s + r.rating, 0) / reviewsCount;
      }
    }

    return {
      id: profile.id,
      name: profile.full_name?.trim() || "Магазин",
      productsCount: products?.length ?? 0,
      reviewsCount,
      avgRating,
      products: (products ?? []) as SellerPublicProduct[],
    };
  });
