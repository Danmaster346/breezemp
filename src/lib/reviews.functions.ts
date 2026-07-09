// Серверные функции для отзывов
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

// Публичный клиент для чтения списка отзывов (без RLS-нюансов)
const publicClient = () =>
  createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );

export type ReviewRow = {
  id: string;
  product_id: string;
  order_item_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  photos: string[];
  author_name: string | null;
  created_at: string;
};

// Публично: отзывы товара + средний рейтинг (только видимые)
export const getProductReviews = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const supa = publicClient();
    const { data: rows, error } = await supa
      .from("reviews")
      .select("id, product_id, order_item_id, user_id, rating, comment, photos, author_name, created_at")
      .eq("product_id", data.product_id)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const reviews = (rows ?? []) as ReviewRow[];
    const count = reviews.length;
    const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
    return { reviews, count, avg };
  });

// Авторизованный пользователь: позиции его заказов, доступные для отзыва
export const getReviewableItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("order_items")
      .select("id, product_id, title_snapshot, image_url, status, order_id, orders!inner(buyer_id, created_at)")
      .eq("orders.buyer_id", context.userId)
      .in("status", ["delivered", "received"]);
    if (error) throw new Error(error.message);

    const items = (data ?? []) as unknown as Array<{
      id: string;
      product_id: string | null;
      title_snapshot: string;
      image_url: string | null;
      status: string;
      order_id: string;
      orders: { created_at: string } | null;
    }>;

    const orderItemIds = items.map((i) => i.id);
    if (!orderItemIds.length) return [];

    const { data: reviewed, error: rErr } = await supabaseAdmin
      .from("reviews")
      .select("order_item_id")
      .in("order_item_id", orderItemIds);
    if (rErr) throw new Error(rErr.message);
    const reviewedSet = new Set((reviewed ?? []).map((r) => r.order_item_id));

    return items
      .filter((i) => i.product_id && !reviewedSet.has(i.id))
      .map((i) => ({
        order_item_id: i.id,
        product_id: i.product_id!,
        title: i.title_snapshot,
        image_url: i.image_url,
        order_created_at: i.orders?.created_at ?? null,
      }));
  });

// Проверка: может ли пользователь оставить отзыв на конкретный товар
export const getReviewableForProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: items, error } = await supabaseAdmin
      .from("order_items")
      .select("id, status, orders!inner(buyer_id)")
      .eq("product_id", data.product_id)
      .eq("orders.buyer_id", context.userId)
      .in("status", ["delivered", "received"]);
    if (error) throw new Error(error.message);
    const rows = (items ?? []) as unknown as Array<{ id: string }>;
    if (!rows.length) return { canReview: false as const };

    const { data: existing } = await supabaseAdmin
      .from("reviews")
      .select("order_item_id")
      .in("order_item_id", rows.map((r) => r.id));
    const usedSet = new Set((existing ?? []).map((r) => r.order_item_id));
    const free = rows.find((r) => !usedSet.has(r.id));
    if (!free) return { canReview: false as const };
    return { canReview: true as const, order_item_id: free.id };
  });

// Создание отзыва
export const createReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        product_id: z.string().uuid(),
        order_item_id: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().trim().max(2000).optional().nullable(),
        photos: z.array(z.string().url()).max(5).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Проверяем, что позиция принадлежит покупателю и в допустимом статусе
    const { data: item, error: itemErr } = await supabaseAdmin
      .from("order_items")
      .select("id, product_id, status, orders!inner(buyer_id)")
      .eq("id", data.order_item_id)
      .maybeSingle();
    if (itemErr) throw new Error(itemErr.message);
    if (!item) throw new Error("Позиция заказа не найдена");
    const orders = (item as unknown as { orders: { buyer_id: string } }).orders;
    if (orders.buyer_id !== context.userId) throw new Error("Нет доступа");
    if (item.product_id !== data.product_id) throw new Error("Товар не совпадает");
    if (!["delivered", "received"].includes(item.status)) {
      throw new Error("Отзыв можно оставить только после получения товара");
    }

    // Получаем имя покупателя из профиля
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const authorName =
      (profile?.full_name && profile.full_name.trim()) ||
      (context.claims as { email?: string })?.email?.split("@")[0] ||
      "Покупатель";

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("reviews")
      .insert({
        product_id: data.product_id,
        order_item_id: data.order_item_id,
        user_id: context.userId,
        rating: data.rating,
        comment: data.comment?.trim() || null,
        photos: data.photos,
        author_name: authorName,
      })
      .select("id")
      .single();
    if (insErr) {
      if (insErr.code === "23505") throw new Error("Вы уже оставили отзыв на этот товар");
      throw new Error(insErr.message);
    }
    return { id: inserted.id };
  });
