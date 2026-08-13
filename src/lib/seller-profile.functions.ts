// Публичная карточка продавца: имя магазина, оформление (логотип, описание, контакты),
// агрегаты (рейтинг, товары, отзывы, доля успешно доставленных) и активные товары.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { computeShopStats, computeAutoBadges } from "./seller-settings.functions";

export type SellerPublicProduct = {
  id: string;
  title: string;
  price_kopecks: number;
  image_url: string | null;
  stock: number;
};

export type SellerContacts = {
  phone: string;
  email: string;
  whatsapp: string;
  telegram: string;
  instagram: string;
  vk: string;
  other_social: string;
};

export type SellerPublicReview = {
  id: string;
  product_id: string;
  product_title: string;
  rating: number;
  comment: string | null;
  photos: string[];
  author_name: string | null;
  created_at: string;
  seller_reply: string | null;
  seller_reply_at: string | null;
};

export type SellerPublicProfile = {
  id: string;
  name: string;
  logoUrl: string | null;
  shortDescription: string;
  fullDescription: string;
  contacts: SellerContacts;
  badges: string[];
  productsCount: number;
  reviewsCount: number;
  avgRating: number;
  deliveredRate: number;
  salesCount: number;
  followersCount: number;
  products: SellerPublicProduct[];
  reviews: SellerPublicReview[];
};


const SIGNED_TTL = 60 * 60 * 24 * 365;

export const getSellerProfile = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<SellerPublicProfile | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("seller_profiles").select("*").eq("user_id", data.id).maybeSingle(),
    ]);
    if (!profile && !settings) return null;

    const { data: products, error: productsErr } = await supabaseAdmin
      .from("products")
      .select("id, title, price_kopecks, image_url, stock")
      .eq("seller_id", data.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (productsErr) throw new Error(productsErr.message);

    const stats = await computeShopStats(data.id);

    let logoUrl: string | null = null;
    const s = settings as null | {
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
    if (s?.logo_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("store-logos")
        .createSignedUrl(s.logo_path, SIGNED_TTL);
      logoUrl = signed?.signedUrl ?? null;
    }

    const badges = Array.from(
      new Set([
        ...(s?.badges ?? []),
        ...computeAutoBadges({
          ordersCount: stats.ordersCount,
          avgRating: stats.avgRating,
          deliveredRate: stats.deliveredRate,
        }),
      ]),
    );

    // Отзывы на товары продавца + количество подписчиков + продажи
    const allProducts = await supabaseAdmin
      .from("products")
      .select("id, title")
      .eq("seller_id", data.id);
    const titleById = new Map(
      (allProducts.data ?? []).map((p) => [(p as { id: string }).id, (p as { title: string }).title]),
    );
    let reviews: SellerPublicReview[] = [];
    if (titleById.size > 0) {
      const { data: rows } = await supabaseAdmin
        .from("reviews")
        .select(
          "id, product_id, rating, comment, photos, author_name, created_at, seller_reply, seller_reply_at",
        )
        .in("product_id", Array.from(titleById.keys()))
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(50);
      reviews = (rows ?? []).map((r) => {
        const row = r as unknown as Omit<SellerPublicReview, "product_title">;
        return {
          ...row,
          photos: row.photos ?? [],
          product_title: titleById.get(row.product_id) ?? "Товар",
        };
      });
    }

    const [{ count: followersCount }, deliveredItems] = await Promise.all([
      supabaseAdmin
        .from("favorites_sellers")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", data.id),
      supabaseAdmin
        .from("order_items")
        .select("quantity, status")
        .eq("seller_id", data.id)
        .in("status", ["delivered", "received"]),
    ]);
    const salesCount = (deliveredItems.data ?? []).reduce(
      (sum, it) => sum + ((it as { quantity: number }).quantity ?? 0),
      0,
    );

    return {
      id: data.id,
      name: (s?.shop_name?.trim() || profile?.full_name?.trim() || "Магазин"),
      logoUrl,
      shortDescription: s?.short_description ?? "",
      fullDescription: s?.full_description ?? "",
      contacts: {
        phone: s?.phone ?? "",
        email: s?.email ?? "",
        whatsapp: s?.whatsapp ?? "",
        telegram: s?.telegram ?? "",
        instagram: s?.instagram ?? "",
        vk: s?.vk ?? "",
        other_social: s?.other_social ?? "",
      },
      badges,
      productsCount: stats.productsCount,
      reviewsCount: stats.reviewsCount,
      avgRating: stats.avgRating,
      deliveredRate: stats.deliveredRate,
      salesCount,
      followersCount: followersCount ?? 0,
      products: (products ?? []) as SellerPublicProduct[],
      reviews,
    };
  });

