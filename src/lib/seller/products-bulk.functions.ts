// Массовые операции с товарами продавца: изменение цены/склада/категории,
// вкл/выкл продажи, удаление, дубликат, импорт CSV, метки и скидки.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const idsSchema = z.array(z.string().uuid()).min(1).max(200);

const bulkSchema = z.object({
  ids: idsSchema,
  action: z.enum(["activate", "deactivate", "price", "stock", "category", "delete", "badges"]),
  // цена: mode percent → value в %, mode fixed → value в копейках (может быть отрицательным для percent)
  price_mode: z.enum(["percent", "fixed"]).optional(),
  value: z.number().int().optional(),
  stock_mode: z.enum(["set", "add"]).optional(),
  category_id: z.string().uuid().nullable().optional(),
  badges: z.array(z.enum(["hit", "new"])).optional(),
});

export const bulkUpdateProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => bulkSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;

    // Разрешаем работать только со своими товарами
    const { data: own, error } = await db
      .from("products")
      .select("id, price_kopecks, stock")
      .eq("seller_id", context.userId)
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    const mine = own ?? [];
    if (mine.length === 0) return { updated: 0 };

    const ids = mine.map((p) => p.id);

    if (data.action === "delete") {
      const del = await db.from("products").delete().eq("seller_id", context.userId).in("id", ids);
      if (del.error) throw new Error(del.error.message);
      return { updated: ids.length };
    }

    if (data.action === "activate" || data.action === "deactivate") {
      const up = await db
        .from("products")
        .update({ is_active: data.action === "activate" })
        .eq("seller_id", context.userId)
        .in("id", ids);
      if (up.error) throw new Error(up.error.message);
      return { updated: ids.length };
    }

    if (data.action === "category") {
      const up = await db
        .from("products")
        .update({ category_id: data.category_id ?? null })
        .eq("seller_id", context.userId)
        .in("id", ids);
      if (up.error) throw new Error(up.error.message);
      return { updated: ids.length };
    }

    if (data.action === "badges") {
      const up = await db
        .from("products")
        .update({ badges: data.badges ?? [] })
        .eq("seller_id", context.userId)
        .in("id", ids);
      if (up.error) throw new Error(up.error.message);
      return { updated: ids.length };
    }

    if (data.action === "stock") {
      if (data.value === undefined) throw new Error("Не указано количество");
      let n = 0;
      for (const p of mine) {
        const next =
          data.stock_mode === "add" ? Math.max(0, p.stock + data.value) : Math.max(0, data.value);
        const up = await db
          .from("products")
          .update({ stock: next })
          .eq("seller_id", context.userId)
          .eq("id", p.id);
        if (!up.error) n += 1;
      }
      return { updated: n };
    }

    // action === "price"
    if (data.value === undefined) throw new Error("Не указано значение цены");
    let n = 0;
    for (const p of mine) {
      const next =
        data.price_mode === "percent"
          ? Math.max(100, Math.round(p.price_kopecks * (1 + data.value / 100)))
          : Math.max(100, data.value);
      // Если цена снижается — фиксируем старую цену как «зачёркнутую»
      const patch = {
        price_kopecks: next,
        compare_at_price_kopecks: next < p.price_kopecks ? p.price_kopecks : null,
      };
      const up = await db
        .from("products")
        .update(patch)

        .eq("seller_id", context.userId)
        .eq("id", p.id);
      if (!up.error) n += 1;
    }
    return { updated: n };
  });

export const duplicateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const { data: p, error } = await db
      .from("products")
      .select("*")
      .eq("id", data.id)
      .eq("seller_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Товар не найден");

    const ins = await db
      .from("products")
      .insert({
        seller_id: context.userId,
        title: `${p.title} (копия)`,
        description: p.description,
        price_kopecks: p.price_kopecks,
        compare_at_price_kopecks: p.compare_at_price_kopecks,
        stock: 0,
        image_url: p.image_url,
        image_urls: p.image_urls,
        category_id: p.category_id,
        badges: p.badges,
        is_active: false,
      })
      .select("id")
      .maybeSingle();
    if (ins.error) throw new Error(ins.error.message);
    return { id: ins.data?.id ?? null };
  });

// Одиночное обновление промо-полей товара (старая цена + метки)
export const updateProductPromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        compare_at_price_kopecks: z.number().int().positive().nullable(),
        badges: z.array(z.enum(["hit", "new"])).max(2),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p, error } = await supabaseAdmin
      .from("products")
      .select("price_kopecks")
      .eq("id", data.id)
      .eq("seller_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Товар не найден");
    if (data.compare_at_price_kopecks !== null && data.compare_at_price_kopecks <= p.price_kopecks) {
      throw new Error("Старая цена должна быть больше текущей");
    }
    const up = await supabaseAdmin
      .from("products")
      .update({
        compare_at_price_kopecks: data.compare_at_price_kopecks,
        badges: data.badges,
      })
      .eq("id", data.id)
      .eq("seller_id", context.userId);
    if (up.error) throw new Error(up.error.message);
    return { ok: true as const };
  });

// ===== Импорт CSV: предпросмотр и применение =====

export type ImportRow = {
  id: string;
  title: string;
  price: number | null; // рубли
  stock: number | null;
  currentPrice: number;
  currentStock: number;
  error?: string;
};

function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const sep = line.includes(";") ? ";" : ",";
      return line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    });
}

const importSchema = z.object({ content: z.string().min(1).max(500_000), apply: z.boolean() });

export const importProductsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => importSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ rows: ImportRow[]; applied: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const table = parseCsv(data.content);
    if (table.length < 2) throw new Error("Файл пустой или без данных");

    const header = (table[0] ?? []).map((h) => h.toLowerCase());
    const idxId = header.findIndex((h) => h === "id");
    const idxPrice = header.findIndex((h) => h.startsWith("цена") || h === "price");
    const idxStock = header.findIndex((h) => h.startsWith("остаток") || h === "stock");
    if (idxId < 0) throw new Error("В файле нет колонки id");

    const { data: own } = await db
      .from("products")
      .select("id, title, price_kopecks, stock")
      .eq("seller_id", context.userId);
    const byId = new Map((own ?? []).map((p) => [p.id, p]));

    const rows: ImportRow[] = [];
    for (const line of table.slice(1)) {
      const id = line[idxId] ?? "";
      const mine = byId.get(id);
      const num = (raw: string | undefined) => {
        if (raw === undefined || raw === "") return null;
        const n = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
        return Number.isFinite(n) ? n : null;
      };
      const price = idxPrice >= 0 ? num(line[idxPrice]) : null;
      const stock = idxStock >= 0 ? num(line[idxStock]) : null;
      if (!mine) {
        rows.push({ id, title: "—", price, stock, currentPrice: 0, currentStock: 0, error: "Товар не найден" });
        continue;
      }
      const row: ImportRow = {
        id,
        title: mine.title,
        price,
        stock: stock === null ? null : Math.max(0, Math.round(stock)),
        currentPrice: mine.price_kopecks / 100,
        currentStock: mine.stock,
      };
      if (price !== null && price <= 0) row.error = "Некорректная цена";
      rows.push(row);
    }

    if (!data.apply) return { rows, applied: 0 };

    let applied = 0;
    for (const r of rows) {
      if (r.error) continue;
      const patch: Record<string, unknown> = {};
      if (r.price !== null) patch['price_kopecks'] = Math.round(r.price * 100);
      if (r.stock !== null) patch['stock'] = r.stock;
      if (Object.keys(patch).length === 0) continue;
      const up = await db.from("products").update(patch).eq("id", r.id).eq("seller_id", context.userId);
      if (!up.error) applied += 1;
    }
    return { rows, applied };
  });

// Статистика по товарам продавца: просмотры и продажи (для сортировки списка)
export const getSellerProductStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const [ev, it] = await Promise.all([
      db.from("product_events").select("product_id, kind").eq("seller_id", context.userId),
      db.from("order_items").select("product_id, quantity, status").eq("seller_id", context.userId),
    ]);
    const views: Record<string, number> = {};
    const carts: Record<string, number> = {};
    for (const e of ev.data ?? []) {
      if (!e.product_id) continue;
      const bag = e.kind === "view" ? views : carts;
      bag[e.product_id] = (bag[e.product_id] ?? 0) + 1;
    }
    const sold: Record<string, number> = {};
    for (const r of it.data ?? []) {
      if (!r.product_id) continue;
      if (["cancelled", "returned", "return_requested"].includes(r.status)) continue;
      sold[r.product_id] = (sold[r.product_id] ?? 0) + r.quantity;
    }
    return { views, carts, sold };
  });
