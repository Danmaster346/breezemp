// Склад продавца: сводка, остатки, инлайн-правки, движения, поставки,
// импорт/экспорт CSV и настройки уведомлений о низком остатке.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type WarehouseRow = {
  id: string;
  title: string;
  sku: string | null;
  image_url: string | null;
  category_name: string | null;
  stock: number;
  min_stock: number;
  price_kopecks: number;
  is_active: boolean;
  moderation_status: string;
};

export type WarehouseSummary = {
  skuCount: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  stockValueKopecks: number;
  threshold: number;
  channel: string;
};

export type WarehouseData = { rows: WarehouseRow[]; summary: WarehouseSummary };

/** Полная витрина склада: товары + агрегаты + настройки уведомлений. */
export const getWarehouse = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WarehouseData> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const [{ data: products, error }, { data: profile }] = await Promise.all([
      db
        .from("products")
        .select(
          "id, title, sku, image_url, stock, min_stock, price_kopecks, is_active, moderation_status, categories(name)",
        )
        .eq("seller_id", context.userId)
        .order("stock", { ascending: true }),
      db
        .from("seller_profiles")
        .select("low_stock_threshold, low_stock_channel")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);

    const threshold = profile?.low_stock_threshold ?? 5;
    const rows: WarehouseRow[] = (products ?? []).map((p) => {
      const cat = (p as { categories?: { name: string } | null }).categories;
      return {
        id: p.id,
        title: p.title,
        sku: p.sku,
        image_url: p.image_url,
        category_name: cat?.name ?? null,
        stock: p.stock,
        min_stock: p.min_stock ?? threshold,
        price_kopecks: p.price_kopecks,
        is_active: p.is_active,
        moderation_status: p.moderation_status,
      };
    });

    return {
      rows,
      summary: {
        skuCount: rows.length,
        inStock: rows.filter((r) => r.stock > Math.max(r.min_stock, 0)).length,
        lowStock: rows.filter((r) => r.stock > 0 && r.stock <= Math.max(r.min_stock, 1)).length,
        outOfStock: rows.filter((r) => r.stock === 0).length,
        stockValueKopecks: rows.reduce((s, r) => s + r.price_kopecks * r.stock, 0),
        threshold,
        channel: profile?.low_stock_channel ?? "app",
      },
    };
  });

/** Запись движения склада (внутренний хелпер, вызывается только на сервере). */
async function logMovement(
  db: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  args: {
    sellerId: string;
    productId: string;
    kind: string;
    before: number;
    after: number;
    reason?: string | null;
  },
) {
  await db.from("stock_movements").insert({
    seller_id: args.sellerId,
    product_id: args.productId,
    kind: args.kind,
    delta: args.after - args.before,
    stock_before: args.before,
    stock_after: args.after,
    reason: args.reason ?? null,
  });
}

const patchSchema = z.object({
  product_id: z.string().uuid(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  min_stock: z.number().int().min(0).max(10_000).optional(),
  sku: z.string().trim().max(64).nullable().optional(),
  reason: z.string().trim().max(200).optional(),
});

/** Инлайн-правка остатка / минимального остатка / артикула. */
export const patchWarehouseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => patchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const { data: product, error } = await db
      .from("products")
      .select("id, stock")
      .eq("id", data.product_id)
      .eq("seller_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) throw new Error("Товар не найден");

    const patch: { stock?: number; min_stock?: number; sku?: string | null } = {};
    if (data.stock !== undefined) patch.stock = data.stock;
    if (data.min_stock !== undefined) patch.min_stock = data.min_stock;
    if (data.sku !== undefined) patch.sku = data.sku || null;
    if (Object.keys(patch).length === 0) return { ok: true };

    const up = await db
      .from("products")
      .update(patch)
      .eq("id", product.id)
      .eq("seller_id", context.userId);
    if (up.error) throw new Error(up.error.message);

    if (data.stock !== undefined && data.stock !== product.stock) {
      await logMovement(db, {
        sellerId: context.userId,
        productId: product.id,
        kind: "manual",
        before: product.stock,
        after: data.stock,
        reason: data.reason ?? "Ручное изменение остатка",
      });
    }
    return { ok: true, stock: data.stock ?? product.stock };
  });

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        sku: z.string().trim().max(64).optional(),
        title: z.string().trim().max(300).optional(),
        stock: z.number().int().min(0).max(1_000_000).optional(),
        price_kopecks: z.number().int().min(0).optional(),
      }),
    )
    .min(1)
    .max(1000),
});

/** Импорт остатков и цен из CSV: сопоставление по артикулу, затем по названию. */
export const importWarehouseCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => importSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const { data: products, error } = await db
      .from("products")
      .select("id, title, sku, stock")
      .eq("seller_id", context.userId);
    if (error) throw new Error(error.message);

    const bySku = new Map<string, { id: string; stock: number }>();
    const byTitle = new Map<string, { id: string; stock: number }>();
    for (const p of products ?? []) {
      if (p.sku) bySku.set(p.sku.trim().toLowerCase(), { id: p.id, stock: p.stock });
      byTitle.set(p.title.trim().toLowerCase(), { id: p.id, stock: p.stock });
    }

    let updated = 0;
    const skipped: string[] = [];
    for (const row of data.rows) {
      const key = row.sku?.trim().toLowerCase();
      const match =
        (key ? bySku.get(key) : undefined) ?? byTitle.get(row.title?.trim().toLowerCase() ?? "");
      if (!match) {
        skipped.push(row.sku || row.title || "—");
        continue;
      }
      const patch: { stock?: number; price_kopecks?: number } = {};
      if (row.stock !== undefined) patch.stock = row.stock;
      if (row.price_kopecks !== undefined) patch.price_kopecks = row.price_kopecks;
      if (Object.keys(patch).length === 0) continue;

      const up = await db
        .from("products")
        .update(patch)
        .eq("id", match.id)
        .eq("seller_id", context.userId);
      if (up.error) throw new Error(up.error.message);
      if (row.stock !== undefined && row.stock !== match.stock) {
        await logMovement(db, {
          sellerId: context.userId,
          productId: match.id,
          kind: "import",
          before: match.stock,
          after: row.stock,
          reason: "Импорт CSV",
        });
      }
      updated += 1;
    }
    return { updated, skipped: skipped.slice(0, 20), skippedCount: skipped.length };
  });

export type MovementRow = {
  id: string;
  created_at: string;
  kind: string;
  delta: number;
  stock_before: number;
  stock_after: number;
  reason: string | null;
  product_id: string | null;
  title: string;
};

const movementsSchema = z
  .object({
    product_id: z.string().uuid().optional(),
    kind: z.string().max(32).optional(),
    days: z.number().int().min(1).max(365).optional(),
  })
  .optional();

/** История движения склада с фильтрами по товару, типу и периоду. */
export const listStockMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => movementsSchema.parse(d))
  .handler(async ({ data, context }): Promise<MovementRow[]> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    let q = db
      .from("stock_movements")
      .select("id, created_at, kind, delta, stock_before, stock_after, reason, product_id, products(title)")
      .eq("seller_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (data?.product_id) q = q.eq("product_id", data.product_id);
    if (data?.kind) q = q.eq("kind", data.kind);
    if (data?.days)
      q = q.gte("created_at", new Date(Date.now() - data.days * 86_400_000).toISOString());

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      kind: r.kind,
      delta: r.delta,
      stock_before: r.stock_before,
      stock_after: r.stock_after,
      reason: r.reason,
      product_id: r.product_id,
      title: (r as { products?: { title: string } | null }).products?.title ?? "Товар удалён",
    }));
  });

const supplySchema = z.object({
  supplied_at: z.string().min(4).max(20),
  comment: z.string().trim().max(500).optional(),
  items: z
    .array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(100_000) }))
    .min(1)
    .max(200),
});

/** Новая поставка: увеличивает остатки и пишет движения. */
export const createSupply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => supplySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const ids = data.items.map((i) => i.product_id);
    const { data: products, error } = await db
      .from("products")
      .select("id, title, stock")
      .eq("seller_id", context.userId)
      .in("id", ids);
    if (error) throw new Error(error.message);
    const mine = new Map((products ?? []).map((p) => [p.id, p]));
    const items = data.items.filter((i) => mine.has(i.product_id));
    if (items.length === 0) throw new Error("Не выбрано ни одного своего товара");

    const { data: supply, error: sErr } = await db
      .from("supplies")
      .insert({
        seller_id: context.userId,
        supplied_at: data.supplied_at,
        comment: data.comment ?? null,
        total_qty: items.reduce((s, i) => s + i.quantity, 0),
      })
      .select("id")
      .single();
    if (sErr) throw new Error(sErr.message);

    for (const item of items) {
      const p = mine.get(item.product_id)!;
      const after = p.stock + item.quantity;
      await db.from("supply_items").insert({
        supply_id: supply.id,
        product_id: p.id,
        title_snapshot: p.title,
        quantity: item.quantity,
      });
      const up = await db
        .from("products")
        .update({ stock: after })
        .eq("id", p.id)
        .eq("seller_id", context.userId);
      if (up.error) throw new Error(up.error.message);
      await logMovement(db, {
        sellerId: context.userId,
        productId: p.id,
        kind: "supply",
        before: p.stock,
        after,
        reason: `Поставка от ${data.supplied_at}`,
      });
    }
    return { id: supply.id, items: items.length };
  });

export type SupplyRow = {
  id: string;
  supplied_at: string;
  comment: string | null;
  total_qty: number;
  items: { title: string; quantity: number }[];
};

/** История поставок с позициями. */
export const listSupplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SupplyRow[]> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data, error } = await db
      .from("supplies")
      .select("id, supplied_at, comment, total_qty, supply_items(title_snapshot, quantity)")
      .eq("seller_id", context.userId)
      .order("supplied_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((s) => ({
      id: s.id,
      supplied_at: s.supplied_at,
      comment: s.comment,
      total_qty: s.total_qty,
      items: ((s as { supply_items?: { title_snapshot: string; quantity: number }[] }).supply_items ?? []).map(
        (i) => ({ title: i.title_snapshot, quantity: i.quantity }),
      ),
    }));
  });

const settingsSchema = z.object({
  low_stock_threshold: z.number().int().min(0).max(10_000),
  low_stock_channel: z.enum(["app", "email", "telegram"]),
});

/** Настройки уведомлений о низком остатке. */
export const saveWarehouseSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const up = await db
      .from("seller_profiles")
      .upsert(
        {
          user_id: context.userId,
          low_stock_threshold: data.low_stock_threshold,
          low_stock_channel: data.low_stock_channel,
        },
        { onConflict: "user_id" },
      );
    if (up.error) throw new Error(up.error.message);
    return { ok: true };
  });
