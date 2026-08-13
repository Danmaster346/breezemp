// Отзывы на товары продавца + ответ продавца на отзыв.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SellerReview = {
  id: string;
  product_id: string;
  product_title: string;
  product_image: string | null;
  rating: number;
  comment: string | null;
  photos: string[];
  author_name: string | null;
  created_at: string;
  seller_reply: string | null;
  seller_reply_at: string | null;
};

export const getSellerReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SellerReview[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;

    const { data: products, error: pErr } = await db
      .from("products")
      .select("id, title, image_url")
      .eq("seller_id", context.userId);
    if (pErr) throw new Error(pErr.message);
    const list = (products ?? []) as { id: string; title: string; image_url: string | null }[];
    if (list.length === 0) return [];

    const map = new Map(list.map((p) => [p.id, p]));
    const { data, error } = await db
      .from("reviews")
      .select(
        "id, product_id, rating, comment, photos, author_name, created_at, seller_reply, seller_reply_at, is_hidden",
      )
      .in(
        "product_id",
        list.map((p) => p.id),
      )
      .eq("is_hidden", false)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return (data ?? []).map((r) => {
      const row = r as unknown as Omit<SellerReview, "product_title" | "product_image">;
      const p = map.get(row.product_id);
      return {
        ...row,
        photos: row.photos ?? [],
        product_title: p?.title ?? "Товар",
        product_image: p?.image_url ?? null,
      };
    });
  });

export const replyToReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        review_id: z.string().uuid(),
        reply: z.string().trim().min(2).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;

    const { data: review, error } = await db
      .from("reviews")
      .select("id, product_id, user_id")
      .eq("id", data.review_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!review) throw new Error("Отзыв не найден");

    const { data: product } = await db
      .from("products")
      .select("id, seller_id, title")
      .eq("id", (review as { product_id: string }).product_id)
      .maybeSingle();
    if (!product || (product as { seller_id: string }).seller_id !== context.userId)
      throw new Error("Можно отвечать только на отзывы о своих товарах");

    const { error: upErr } = await db
      .from("reviews")
      .update({ seller_reply: data.reply.trim(), seller_reply_at: new Date().toISOString() })
      .eq("id", data.review_id);
    if (upErr) throw new Error(upErr.message);

    // Уведомляем автора отзыва
    await db.from("user_notifications").insert({
      user_id: (review as { user_id: string }).user_id,
      title: "Продавец ответил на ваш отзыв",
      body: `«${(product as { title: string }).title}» — читайте ответ на странице товара`,
      link: `/product/${(product as { id: string }).id}`,
      type: "review",
    });

    return { ok: true };
  });
