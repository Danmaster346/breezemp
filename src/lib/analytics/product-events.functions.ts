// Учёт событий по товарам: просмотры карточек и добавления в корзину.
// Пишем только через сервер (service role), чтобы клиент не мог подделать продавца.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  product_id: z.string().uuid(),
  kind: z.enum(["view", "add_to_cart"]),
  visitor: z.string().trim().min(6).max(64),
});

export const trackProductEvent = createServerFn({ method: "POST" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Продавца берём из БД — клиент его не передаёт
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id, seller_id")
      .eq("id", data.product_id)
      .maybeSingle();
    if (!product) return { ok: false as const };

    // Простая защита от накрутки: не больше одного такого события
    // от одного посетителя по одному товару за 30 минут
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("product_events")
      .select("id", { count: "exact", head: true })
      .eq("product_id", data.product_id)
      .eq("kind", data.kind)
      .eq("visitor_hash", data.visitor)
      .gte("created_at", since);
    if ((count ?? 0) > 0) return { ok: true as const, deduped: true };

    await supabaseAdmin.from("product_events").insert({
      product_id: product.id,
      seller_id: product.seller_id,
      kind: data.kind,
      visitor_hash: data.visitor,
    });
    return { ok: true as const };
  });
