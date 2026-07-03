// Серверные функции для оформления заказов с расчётом комиссии платформы 10%
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { calcShippingCost, getShippingOption } from "@/lib/shipping";
import { computeDiscountKopecks } from "@/lib/promo.functions";

// Ставка комиссии платформы (10%)
const COMMISSION_RATE = 0.1;

// Схема входа: список позиций, данные доставки, способ и промокод
const createOrderSchema = z.object({
  items: z
    .array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().positive() }))
    .min(1),
  shipping_name: z.string().trim().min(1).max(100),
  shipping_phone: z.string().trim().min(3).max(30),
  shipping_address: z.string().trim().min(3).max(500),
  shipping_method: z.enum(["pickup", "cdek", "yandex"]).default("pickup"),
  promo_code: z.string().trim().max(64).optional().nullable(),
  // Флаг тестовой оплаты — сразу помечаем позиции как «Подтверждён»
  paid: z.boolean().optional(),
});

// Создание заказа: валидируем цены и остатки на сервере
export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createOrderSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Клиент от лица пользователя (RLS применяется)
    const { supabase, userId } = context;

    // Достаём актуальные товары из БД
    const productIds = data.items.map((i) => i.product_id);
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, seller_id, title, image_url, price_kopecks, stock, is_active")
      .in("id", productIds);
    if (prodErr) throw new Error(prodErr.message);
    if (!products || products.length !== data.items.length) {
      throw new Error("Некоторые товары недоступны");
    }

    // Считаем позиции заказа с проверкой остатков
    let total = 0; // итог заказа в копейках
    let commissionTotal = 0; // общая комиссия платформы
    const itemsToInsert: Array<{
      product_id: string;
      seller_id: string;
      title_snapshot: string;
      image_url: string | null;
      price_kopecks: number;
      quantity: number;
      commission_kopecks: number;
    }> = [];

    for (const it of data.items) {
      // Находим товар из БД по id
      const p = products.find((pp) => pp.id === it.product_id);
      if (!p) throw new Error("Товар не найден");
      if (!p.is_active) throw new Error(`Товар «${p.title}» больше не продаётся`);
      if (p.stock < it.quantity) throw new Error(`Недостаточно товара «${p.title}» на складе`);
      // Считаем сумму позиции и комиссию
      const lineTotal = p.price_kopecks * it.quantity;
      const commission = Math.round(lineTotal * COMMISSION_RATE);
      total += lineTotal;
      commissionTotal += commission;
      itemsToInsert.push({
        product_id: p.id,
        seller_id: p.seller_id,
        title_snapshot: p.title,
        image_url: p.image_url,
        price_kopecks: p.price_kopecks,
        quantity: it.quantity,
        commission_kopecks: commission,
      });
    }

    // Записи в orders/order_items разрешены только сервис-роли — используем admin-клиент
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Стоимость доставки считаем на сервере из константной таблицы
    const shippingOption = getShippingOption(data.shipping_method);
    const shippingCost = calcShippingCost(data.shipping_method, total);

    // Валидация промокода (если указан) и вычисление скидки
    let promoCode: string | null = null;
    let discount = 0;
    if (data.promo_code && data.promo_code.trim().length > 0) {
      const code = data.promo_code.trim().toUpperCase();
      const { data: promo, error: promoErr } = await supabaseAdmin
        .from("promo_codes")
        .select("code, discount_type, discount_value, active, expires_at, max_uses, used_count, min_order_kopecks")
        .eq("code", code)
        .maybeSingle();
      if (promoErr) throw new Error(promoErr.message);
      if (!promo || !promo.active) throw new Error("Промокод не найден или неактивен");
      if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
        throw new Error("Срок действия промокода истёк");
      }
      if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
        throw new Error("Промокод больше не действует");
      }
      if (total < promo.min_order_kopecks) {
        throw new Error(`Промокод действует от суммы ${(promo.min_order_kopecks / 100).toFixed(0)} ₽`);
      }
      discount = computeDiscountKopecks(promo, total);
      promoCode = promo.code;
      await supabaseAdmin
        .from("promo_codes")
        .update({ used_count: promo.used_count + 1 })
        .eq("code", promo.code);
    }

    const finalTotal = Math.max(0, total - discount) + shippingCost;

    // Создаём заказ (через service role, минуя RLS, но с проверенными на сервере данными)
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        buyer_id: userId,
        total_kopecks: finalTotal,
        commission_kopecks: commissionTotal,
        shipping_name: data.shipping_name,
        shipping_phone: data.shipping_phone,
        shipping_address: data.shipping_address,
        shipping_method: shippingOption.id,
        shipping_cost_kopecks: shippingCost,
        promo_code: promoCode,
        discount_kopecks: discount,
      })
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(orderErr?.message ?? "Не удалось создать заказ");

    // Вставляем позиции заказа; при тестовой оплате статус сразу «На сборке»
    const initialStatus = data.paid ? "processing" : "new";
    const { error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .insert(
        itemsToInsert.map((i) => ({ ...i, order_id: order.id, status: initialStatus })),
      );
    if (itemsErr) throw new Error(itemsErr.message);

    // Списываем остатки со склада
    for (const it of data.items) {
      const p = products.find((pp) => pp.id === it.product_id)!;
      await supabaseAdmin
        .from("products")
        .update({ stock: p.stock - it.quantity })
        .eq("id", p.id);
    }

    // Возвращаем идентификатор нового заказа
    return { id: order.id };
  });
