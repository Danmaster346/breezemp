// Умный поиск/фильтры каталога. Работает как публичный анонимный клиент,
// но использует supabaseAdmin для агрегаций (рейтинги, продажи, имена продавцов).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CatalogItem = {
  id: string;
  title: string;
  price_kopecks: number;
  compare_at_price_kopecks: number | null;
  image_url: string | null;
  stock: number;
  category_slug: string | null;
  seller_id: string;
  seller_name: string;
  rating: number; // 0..5
  reviews_count: number;
  orders_count: number;
  created_at: string;
};

export type CatalogSellerOption = {
  id: string;
  name: string;
  products_count: number;
};

export type CatalogSuggestion = {
  id: string;
  title: string;
  price_kopecks: number;
  image_url: string | null;
  seller_name: string;
};

const filterSchema = z.object({
  q: z.string().max(200).optional(),
  category: z.string().max(64).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  min_rating: z.number().optional(),
  seller_id: z.string().uuid().optional(),
  in_stock: z.boolean().optional(),
  discount: z.boolean().optional(),
  sort: z
    .enum([
      "relevance",
      "new",
      "price_asc",
      "price_desc",
      "rating",
      "popular",
    ])
    .optional()
    .default("relevance"),
  limit: z.number().int().min(1).max(240).optional().default(120),
});

function safeIlike(s: string) {
  return s.replace(/[%,\\]/g, " ").trim();
}

async function enrich(products: Array<{ id: string; seller_id: string }>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids = products.map((p) => p.id);
  const sellerIds = Array.from(new Set(products.map((p) => p.seller_id)));

  const [reviewsRes, orderItemsRes, profilesRes, sellerProfilesRes] =
    await Promise.all([
      ids.length
        ? supabaseAdmin.from("reviews").select("product_id, rating").in("product_id", ids)
        : Promise.resolve({ data: [] as { product_id: string; rating: number }[], error: null }),
      ids.length
        ? supabaseAdmin.from("order_items").select("product_id").in("product_id", ids)
        : Promise.resolve({ data: [] as { product_id: string | null }[], error: null }),
      sellerIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name").in("id", sellerIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null }),
      sellerIds.length
        ? supabaseAdmin.from("seller_profiles").select("user_id, shop_name").in("user_id", sellerIds)
        : Promise.resolve({ data: [] as { user_id: string; shop_name: string | null }[], error: null }),
    ]);

  const ratingMap = new Map<string, { sum: number; n: number }>();
  for (const r of reviewsRes.data ?? []) {
    const cur = ratingMap.get(r.product_id) ?? { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    ratingMap.set(r.product_id, cur);
  }
  const ordersMap = new Map<string, number>();
  for (const o of orderItemsRes.data ?? []) {
    if (!o.product_id) continue;
    ordersMap.set(o.product_id, (ordersMap.get(o.product_id) ?? 0) + 1);
  }
  const nameMap = new Map<string, string>();
  for (const p of profilesRes.data ?? []) {
    if (p.full_name?.trim()) nameMap.set(p.id, p.full_name.trim());
  }
  for (const sp of sellerProfilesRes.data ?? []) {
    if (sp.shop_name?.trim()) nameMap.set(sp.user_id, sp.shop_name.trim());
  }

  return { ratingMap, ordersMap, nameMap };
}

export const searchCatalog = createServerFn({ method: "GET" })
  .inputValidator((d) => filterSchema.parse(d))
  .handler(async ({ data }): Promise<{ items: CatalogItem[]; total: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) SQL-фильтры по продуктам + поиск по названию/описанию и по имени продавца
    let sellerIdsByName: string[] | null = null;
    if (data.q) {
      const safe = safeIlike(data.q);
      if (safe) {
        const [{ data: profs }, { data: shops }] = await Promise.all([
          supabaseAdmin.from("profiles").select("id").ilike("full_name", `%${safe}%`),
          supabaseAdmin.from("seller_profiles").select("user_id").ilike("shop_name", `%${safe}%`),
        ]);
        const set = new Set<string>();
        for (const p of profs ?? []) set.add(p.id);
        for (const s of shops ?? []) set.add(s.user_id);
        sellerIdsByName = Array.from(set);
      }
    }

    let query = supabaseAdmin
      .from("products")
      .select(
        "id, title, description, price_kopecks, compare_at_price_kopecks, image_url, stock, seller_id, created_at, categories(slug)",
      )
      .eq("is_active", true)
      .eq("moderation_status", "approved")
      .limit(data.limit);

    if (data.q) {
      const safe = safeIlike(data.q);
      if (safe) {
        const orParts = [
          `title.ilike.%${safe}%`,
          `description.ilike.%${safe}%`,
        ];
        if (sellerIdsByName && sellerIdsByName.length > 0) {
          orParts.push(`seller_id.in.(${sellerIdsByName.join(",")})`);
        }
        query = query.or(orParts.join(","));
      }
    }
    if (data.category) {
      const { data: cat } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("slug", data.category)
        .maybeSingle();
      if (cat) query = query.eq("category_id", cat.id);
      else return { items: [], total: 0 };
    }
    if (data.min) query = query.gte("price_kopecks", data.min * 100);
    if (data.max) query = query.lte("price_kopecks", data.max * 100);
    if (data.seller_id) query = query.eq("seller_id", data.seller_id);
    if (data.in_stock) query = query.gt("stock", 0);
    if (data.discount) {
      // Акционным считаем товар, у которого указана более высокая старая цена
      query = query.not("compare_at_price_kopecks", "is", null);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const list = rows ?? [];

    // 2) Обогащение
    const { ratingMap, ordersMap, nameMap } = await enrich(list);

    let items: CatalogItem[] = list.map((p) => {
      const r = ratingMap.get(p.id);
      const rating = r && r.n > 0 ? r.sum / r.n : 0;
      const cat = p.categories as { slug: string } | { slug: string }[] | null;
      const categorySlug = Array.isArray(cat) ? cat[0]?.slug ?? null : cat?.slug ?? null;
      return {
        id: p.id,
        title: p.title,
        price_kopecks: p.price_kopecks,
        compare_at_price_kopecks: p.compare_at_price_kopecks,
        image_url: p.image_url,
        stock: p.stock,
        category_slug: categorySlug,
        seller_id: p.seller_id,
        seller_name: nameMap.get(p.seller_id) ?? "Магазин",
        rating,
        reviews_count: r?.n ?? 0,
        orders_count: ordersMap.get(p.id) ?? 0,
        created_at: p.created_at,
      };
    });

    // 3) Фильтр «со скидкой» — старая цена должна быть выше текущей
    if (data.discount) {
      items = items.filter(
        (i) =>
          i.compare_at_price_kopecks != null &&
          i.compare_at_price_kopecks > i.price_kopecks,
      );
    }

    // 3) Фильтр по рейтингу
    if (data.min_rating && data.min_rating > 0) {
      items = items.filter((i) => i.rating >= data.min_rating!);
    }

    // 4) Сортировка
    const q = data.q ? safeIlike(data.q).toLowerCase() : "";
    const rankRelevance = (it: CatalogItem) => {
      if (!q) return 0;
      const t = it.title.toLowerCase();
      if (t === q) return 100;
      if (t.startsWith(q)) return 80;
      if (t.includes(q)) return 60;
      if (it.seller_name.toLowerCase().includes(q)) return 40;
      return 20; // matched via description
    };
    items.sort((a, b) => {
      switch (data.sort) {
        case "price_asc":
          return a.price_kopecks - b.price_kopecks;
        case "price_desc":
          return b.price_kopecks - a.price_kopecks;
        case "rating":
          return b.rating - a.rating || b.reviews_count - a.reviews_count;
        case "popular":
          return b.orders_count - a.orders_count || b.rating - a.rating;
        case "new":
          return b.created_at.localeCompare(a.created_at);
        case "relevance":
        default:
          if (q) {
            const dr = rankRelevance(b) - rankRelevance(a);
            if (dr !== 0) return dr;
          }
          return b.created_at.localeCompare(a.created_at);
      }
    });

    return { items, total: items.length };
  });

export const suggestCatalog = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }): Promise<CatalogSuggestion[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = safeIlike(data.q);
    if (!safe) return [];

    const [{ data: profs }, { data: shops }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id").ilike("full_name", `%${safe}%`).limit(20),
      supabaseAdmin.from("seller_profiles").select("user_id").ilike("shop_name", `%${safe}%`).limit(20),
    ]);
    const sellerIds = Array.from(
      new Set<string>([
        ...(profs ?? []).map((p) => p.id),
        ...(shops ?? []).map((s) => s.user_id),
      ]),
    );

    const orParts = [`title.ilike.%${safe}%`, `description.ilike.%${safe}%`];
    if (sellerIds.length > 0) orParts.push(`seller_id.in.(${sellerIds.join(",")})`);

    const { data: rows } = await supabaseAdmin
      .from("products")
      .select("id, title, price_kopecks, image_url, seller_id")
      .eq("is_active", true)
      .eq("moderation_status", "approved")
      .or(orParts.join(","))
      .limit(8);

    const list = rows ?? [];
    const uniqSellers = Array.from(new Set(list.map((r) => r.seller_id)));
    const [{ data: profRows }, { data: shopRows }] = await Promise.all([
      uniqSellers.length
        ? supabaseAdmin.from("profiles").select("id, full_name").in("id", uniqSellers)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      uniqSellers.length
        ? supabaseAdmin.from("seller_profiles").select("user_id, shop_name").in("user_id", uniqSellers)
        : Promise.resolve({ data: [] as { user_id: string; shop_name: string | null }[] }),
    ]);
    const nameMap = new Map<string, string>();
    for (const p of profRows ?? []) if (p.full_name?.trim()) nameMap.set(p.id, p.full_name.trim());
    for (const s of shopRows ?? []) if (s.shop_name?.trim()) nameMap.set(s.user_id, s.shop_name.trim());

    // Ранжирование: точнее совпадение — выше
    const qLow = safe.toLowerCase();
    const rank = (t: string) => {
      const s = t.toLowerCase();
      if (s === qLow) return 100;
      if (s.startsWith(qLow)) return 80;
      if (s.includes(qLow)) return 60;
      return 20;
    };
    return list
      .map((p) => ({
        id: p.id,
        title: p.title,
        price_kopecks: p.price_kopecks,
        image_url: p.image_url,
        seller_name: nameMap.get(p.seller_id) ?? "Магазин",
      }))
      .sort((a, b) => rank(b.title) - rank(a.title));
  });

export const listCatalogSellers = createServerFn({ method: "GET" })
  .handler(async (): Promise<CatalogSellerOption[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("products")
      .select("seller_id")
      .eq("is_active", true);
    const counts = new Map<string, number>();
    for (const r of rows ?? []) counts.set(r.seller_id, (counts.get(r.seller_id) ?? 0) + 1);
    const ids = Array.from(counts.keys());
    if (ids.length === 0) return [];

    const [{ data: profs }, { data: shops }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
      supabaseAdmin.from("seller_profiles").select("user_id, shop_name").in("user_id", ids),
    ]);
    const nameMap = new Map<string, string>();
    for (const p of profs ?? []) if (p.full_name?.trim()) nameMap.set(p.id, p.full_name.trim());
    for (const s of shops ?? []) if (s.shop_name?.trim()) nameMap.set(s.user_id, s.shop_name.trim());

    return ids
      .map((id) => ({
        id,
        name: nameMap.get(id) ?? "Магазин",
        products_count: counts.get(id) ?? 0,
      }))
      .sort((a, b) => b.products_count - a.products_count);
  });
