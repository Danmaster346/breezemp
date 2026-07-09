// Серверные функции для чата между покупателем и продавцом.
// RLS уже фильтрует данные — используем клиент от лица пользователя.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SIGNED_URL_TTL = 60 * 60; // 1 час

async function signImagePath(
  supabase: { storage: { from: (b: string) => { createSignedUrl: (p: string, t: number) => Promise<{ data: { signedUrl: string } | null; error: unknown }> } } },
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("chat-photos").createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

// Создание/поиск чата покупателем с продавцом (можно привязать к товару/заказу)
export const getOrCreateChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        seller_id: z.string().uuid(),
        product_id: z.string().uuid().optional().nullable(),
        order_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.seller_id === userId) throw new Error("Нельзя написать самому себе");

    // Ищем существующий чат (buyer, seller, product)
    let query = supabase
      .from("chats")
      .select("id")
      .eq("buyer_id", userId)
      .eq("seller_id", data.seller_id);
    query = data.product_id
      ? query.eq("product_id", data.product_id)
      : query.is("product_id", null);
    const { data: existing } = await query.maybeSingle();
    if (existing) return { id: existing.id };

    const { data: created, error } = await supabase
      .from("chats")
      .insert({
        buyer_id: userId,
        seller_id: data.seller_id,
        product_id: data.product_id ?? null,
        order_id: data.order_id ?? null,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Не удалось создать чат");
    return { id: created.id };
  });

// Список чатов текущего пользователя (и как покупателя, и как продавца)
export const listChats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: chats, error } = await supabase
      .from("chats")
      .select("id, buyer_id, seller_id, product_id, order_id, last_message_at")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    if (!chats || chats.length === 0) return [];

    // Собираем связки: контрагенты, товары, последние сообщения, непрочитанные
    const otherIds = Array.from(
      new Set(chats.map((c) => (c.buyer_id === userId ? c.seller_id : c.buyer_id))),
    );
    const productIds = Array.from(
      new Set(chats.map((c) => c.product_id).filter(Boolean) as string[]),
    );
    const chatIds = chats.map((c) => c.id);

    const [{ data: profiles }, { data: products }, { data: lastMsgs }, { data: unread }] =
      await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", otherIds),
        productIds.length
          ? supabase
              .from("products")
              .select("id, title, image_url")
              .in("id", productIds)
          : Promise.resolve({ data: [] as { id: string; title: string; image_url: string | null }[] }),
        supabase
          .from("chat_messages")
          .select("chat_id, body, image_path, created_at, sender_id")
          .in("chat_id", chatIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("chat_messages")
          .select("chat_id")
          .in("chat_id", chatIds)
          .neq("sender_id", userId)
          .is("read_at", null),
      ]);

    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const prodMap = new Map((products ?? []).map((p) => [p.id, p]));
    const lastMap = new Map<string, { body: string | null; image_path: string | null; created_at: string; sender_id: string }>();
    for (const m of lastMsgs ?? []) {
      if (!lastMap.has(m.chat_id)) lastMap.set(m.chat_id, m);
    }
    const unreadMap = new Map<string, number>();
    for (const m of unread ?? []) {
      unreadMap.set(m.chat_id, (unreadMap.get(m.chat_id) ?? 0) + 1);
    }

    return chats.map((c) => {
      const otherId = c.buyer_id === userId ? c.seller_id : c.buyer_id;
      const prof = profMap.get(otherId);
      const prod = c.product_id ? prodMap.get(c.product_id) : null;
      const last = lastMap.get(c.id) ?? null;
      return {
        id: c.id,
        role: c.buyer_id === userId ? ("buyer" as const) : ("seller" as const),
        other: { id: otherId, full_name: prof?.full_name ?? "Пользователь" },
        product: prod ? { id: prod.id, title: prod.title, image_url: prod.image_url } : null,
        order_id: c.order_id,
        last_message: last
          ? {
              body: last.body,
              has_image: !!last.image_path,
              created_at: last.created_at,
              from_me: last.sender_id === userId,
            }
          : null,
        last_message_at: c.last_message_at,
        unread: unreadMap.get(c.id) ?? 0,
      };
    });
  });

// Загрузка сообщений чата + метаданные и авто-пометка прочитанным
export const getChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ chat_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: chat, error: chatErr } = await supabase
      .from("chats")
      .select("id, buyer_id, seller_id, product_id, order_id")
      .eq("id", data.chat_id)
      .single();
    if (chatErr || !chat) throw new Error("Чат не найден");
    if (chat.buyer_id !== userId && chat.seller_id !== userId) throw new Error("Нет доступа");

    const otherId = chat.buyer_id === userId ? chat.seller_id : chat.buyer_id;
    const [{ data: other }, product, { data: msgs }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("id", otherId).maybeSingle(),
      chat.product_id
        ? supabase
            .from("products")
            .select("id, title, image_url, price_kopecks")
            .eq("id", chat.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null as null | { id: string; title: string; image_url: string | null; price_kopecks: number } }),
      supabase
        .from("chat_messages")
        .select("id, sender_id, body, image_path, created_at, read_at")
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: true })
        .limit(500),
    ]);

    // Помечаем чужие сообщения прочитанными
    await supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("chat_id", chat.id)
      .neq("sender_id", userId)
      .is("read_at", null);

    const messages = await Promise.all(
      (msgs ?? []).map(async (m) => ({
        id: m.id,
        sender_id: m.sender_id,
        body: m.body,
        image_url: await signImagePath(supabase, m.image_path),
        created_at: m.created_at,
        from_me: m.sender_id === userId,
      })),
    );

    return {
      chat: {
        id: chat.id,
        role: chat.buyer_id === userId ? ("buyer" as const) : ("seller" as const),
        other: { id: otherId, full_name: other?.full_name ?? "Пользователь" },
        product: product.data ?? null,
        order_id: chat.order_id,
      },
      messages,
    };
  });

// Отправка сообщения (текст и/или картинка)
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        chat_id: z.string().uuid(),
        body: z.string().trim().max(2000).optional().nullable(),
        image_path: z.string().max(500).optional().nullable(),
      })
      .refine((v) => (v.body && v.body.length > 0) || v.image_path, {
        message: "Пустое сообщение",
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Явная проверка, что отправитель — участник чата (не полагаемся только на RLS)
    const { data: chat, error: chatErr } = await supabase
      .from("chats")
      .select("id, buyer_id, seller_id")
      .eq("id", data.chat_id)
      .single();
    if (chatErr || !chat) throw new Error("Чат не найден");
    if (chat.buyer_id !== userId && chat.seller_id !== userId) throw new Error("Нет доступа к чату");

    const body = data.body?.trim() || null;
    const { error } = await supabase.from("chat_messages").insert({
      chat_id: data.chat_id,
      sender_id: userId,
      body,
      image_path: data.image_path ?? null,
    });
    if (error) throw new Error(error.message);
    // Поднимаем чат наверх списка
    await supabase
      .from("chats")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", data.chat_id);
    return { ok: true };
  });

// Количество непрочитанных сообщений — для бейджа в шапке
export const getUnreadChatCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { count } = await supabase
      .from("chat_messages")
      .select("id, chats!inner(buyer_id, seller_id)", { count: "exact", head: true })
      .neq("sender_id", userId)
      .is("read_at", null)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`, { referencedTable: "chats" });
    return { count: count ?? 0 };
  });
