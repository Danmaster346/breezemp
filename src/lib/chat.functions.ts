// Серверные функции для чата между покупателем и продавцом.
// Все операции проходят через сервер: сначала проверяем участника, затем пишем в БД.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type ChatRecord = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  order_id: string | null;
  last_message_at: string;
};

type ProfileRecord = { id: string; full_name: string | null };
type ProductRecord = { id: string; title: string; image_url: string | null };
type LastMessageRecord = {
  chat_id: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
  sender_id: string;
};
type UnreadRecord = { chat_id: string };

// Создание/поиск чата покупателем с продавцом (можно привязать к товару/заказу)
export const getOrCreateChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        seller_id: z.string().uuid(),
        product_id: z.string().uuid().optional().nullable(),
        order_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.seller_id === userId) throw new Error("Нельзя написать самому себе");

    if (data.product_id) {
      const { data: product, error: productErr } = await supabaseAdmin
        .from("products")
        .select("id, seller_id")
        .eq("id", data.product_id)
        .maybeSingle();
      if (productErr || !product) throw new Error("Товар не найден");
      if (product.seller_id !== data.seller_id) throw new Error("Неверный продавец товара");
    }

    if (data.order_id) {
      const { data: order, error: orderErr } = await supabaseAdmin
        .from("orders")
        .select("id, buyer_id")
        .eq("id", data.order_id)
        .maybeSingle();
      if (orderErr || !order) throw new Error("Заказ не найден");
      if (order.buyer_id !== userId) {
        throw new Error("Нет доступа к заказу");
      }
      let itemQuery = supabaseAdmin
        .from("order_items")
        .select("id")
        .eq("order_id", data.order_id)
        .eq("seller_id", data.seller_id);
      if (data.product_id) itemQuery = itemQuery.eq("product_id", data.product_id);
      const { data: orderItem, error: orderItemErr } = await itemQuery.limit(1).maybeSingle();
      if (orderItemErr || !orderItem) throw new Error("Продавец не найден в этом заказе");
    }

    // Ищем существующий чат (buyer, seller, product)
    let query = supabaseAdmin
      .from("chats")
      .select("id")
      .eq("buyer_id", userId)
      .eq("seller_id", data.seller_id);
    query = data.product_id
      ? query.eq("product_id", data.product_id)
      : query.is("product_id", null);
    const { data: existing } = await query.maybeSingle();
    if (existing) return { id: existing.id };

    const { data: created, error } = await supabaseAdmin
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

// Создание/поиск чата по конкретной позиции заказа.
// Работает и для покупателя, и для продавца: сервер сам определяет участников заказа.
export const getOrCreateOrderChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ order_item_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tag = `[chat.open.order item=${data.order_item_id} user=${userId}]`;

    const { data: item, error: itemErr } = await supabaseAdmin
      .from("order_items")
      .select("id, order_id, seller_id, product_id")
      .eq("id", data.order_item_id)
      .maybeSingle();
    if (itemErr) {
      console.error(`${tag} item lookup failed`, itemErr);
      throw new Error(itemErr.message);
    }
    if (!item) throw new Error("Позиция заказа не найдена");

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id")
      .eq("id", item.order_id)
      .maybeSingle();
    if (orderErr) {
      console.error(`${tag} order lookup failed`, orderErr);
      throw new Error(orderErr.message);
    }
    if (!order) throw new Error("Заказ не найден");
    if (order.buyer_id !== userId && item.seller_id !== userId) {
      throw new Error("Нет доступа к чату по этому заказу");
    }
    if (order.buyer_id === item.seller_id) {
      throw new Error("Покупатель и продавец совпадают — чат с самим собой недоступен");
    }

    let existingQuery = supabaseAdmin
      .from("chats")
      .select("id")
      .eq("buyer_id", order.buyer_id)
      .eq("seller_id", item.seller_id);
    existingQuery = item.product_id
      ? existingQuery.eq("product_id", item.product_id)
      : existingQuery.is("product_id", null);
    const { data: existing, error: existingErr } = await existingQuery.maybeSingle();
    if (existingErr) {
      console.error(`${tag} existing lookup failed`, existingErr);
      throw new Error(existingErr.message);
    }
    if (existing) return { id: existing.id };

    const { data: created, error } = await supabaseAdmin
      .from("chats")
      .insert({
        buyer_id: order.buyer_id,
        seller_id: item.seller_id,
        product_id: item.product_id,
        order_id: order.id,
      })
      .select("id")
      .single();
    if (error || !created) {
      console.error(`${tag} create failed`, error);
      throw new Error(error?.message ?? "Не удалось открыть чат по заказу");
    }
    console.log(`${tag} ok`, { chat_id: created.id });
    return { id: created.id };
  });

// Список чатов текущего пользователя (и как покупателя, и как продавца)
export const listChats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: chats, error } = await supabaseAdmin
      .from("chats")
      .select("id, buyer_id, seller_id, product_id, order_id, last_message_at")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const chatRows = (chats ?? []) as ChatRecord[];
    if (chatRows.length === 0) return [];

    // Собираем связки: контрагенты, товары, последние сообщения, непрочитанные
    const otherIds: string[] = Array.from(
      new Set(chatRows.map((c) => (c.buyer_id === userId ? c.seller_id : c.buyer_id))),
    );
    const productIds: string[] = Array.from(
      new Set(chatRows.map((c) => c.product_id).filter((id): id is string => Boolean(id))),
    );
    const chatIds: string[] = chatRows.map((c) => c.id);

    const [{ data: profiles }, { data: products }, { data: lastMsgs }, { data: unread }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, full_name").in("id", otherIds),
        productIds.length
          ? supabaseAdmin
              .from("products")
              .select("id, title, image_url")
              .in("id", productIds)
          : Promise.resolve({ data: [] as { id: string; title: string; image_url: string | null }[] }),
        supabaseAdmin
          .from("chat_messages")
          .select("chat_id, body, image_path, created_at, sender_id")
          .in("chat_id", chatIds)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("chat_messages")
          .select("chat_id")
          .in("chat_id", chatIds)
          .neq("sender_id", userId)
          .is("read_at", null),
      ]);

    const profMap = new Map(((profiles ?? []) as ProfileRecord[]).map((p) => [p.id, p]));
    const prodMap = new Map(((products ?? []) as ProductRecord[]).map((p) => [p.id, p]));
    const lastMap = new Map<string, { body: string | null; image_path: string | null; created_at: string; sender_id: string }>();
    for (const m of (lastMsgs ?? []) as LastMessageRecord[]) {
      if (!lastMap.has(m.chat_id)) lastMap.set(m.chat_id, m);
    }
    const unreadMap = new Map<string, number>();
    for (const m of (unread ?? []) as UnreadRecord[]) {
      unreadMap.set(m.chat_id, (unreadMap.get(m.chat_id) ?? 0) + 1);
    }

    return chatRows.map((c) => {
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
// Пагинация: возвращаем последние `limit` сообщений старше `before` (если задан).
// В ответе — по возрастанию created_at + флаг hasMore для «Загрузить ещё».
const CHAT_PAGE_SIZE = 30;

export const getChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        chat_id: z.string().uuid(),
        before: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: chat, error: chatErr } = await supabaseAdmin
      .from("chats")
      .select("id, buyer_id, seller_id, product_id, order_id")
      .eq("id", data.chat_id)
      .single();
    if (chatErr || !chat) throw new Error("Чат не найден");
    if (chat.buyer_id !== userId && chat.seller_id !== userId) throw new Error("Нет доступа");

    const limit = data.limit ?? CHAT_PAGE_SIZE;
    const isInitial = !data.before;
    const otherId = chat.buyer_id === userId ? chat.seller_id : chat.buyer_id;

    let msgsQuery = supabaseAdmin
      .from("chat_messages")
      .select("id, sender_id, body, image_path, created_at, delivered_at, read_at")
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (data.before) msgsQuery = msgsQuery.lt("created_at", data.before);

    const [{ data: other }, product, { data: msgsDesc }] = await Promise.all([
      isInitial
        ? supabaseAdmin.from("profiles").select("id, full_name").eq("id", otherId).maybeSingle()
        : Promise.resolve({ data: null as null | { id: string; full_name: string | null } }),
      isInitial && chat.product_id
        ? supabaseAdmin
            .from("products")
            .select("id, title, image_url, price_kopecks")
            .eq("id", chat.product_id)
            .maybeSingle()
        : Promise.resolve({ data: null as null | { id: string; title: string; image_url: string | null; price_kopecks: number } }),
      msgsQuery,
    ]);

    const rowsDesc = msgsDesc ?? [];
    const hasMore = rowsDesc.length > limit;
    const pageRows = (hasMore ? rowsDesc.slice(0, limit) : rowsDesc).slice().reverse();

    // При открытии треда помечаем чужие сообщения одновременно доставленными и прочитанными.
    // При подгрузке старых сообщений — только доставленными (историю не считаем «прочитанной заново»).
    const nowIso = new Date().toISOString();
    if (isInitial) {
      await supabaseAdmin
        .from("chat_messages")
        .update({ delivered_at: nowIso, read_at: nowIso })
        .eq("chat_id", chat.id)
        .neq("sender_id", userId)
        .is("read_at", null);
    } else {
      await supabaseAdmin
        .from("chat_messages")
        .update({ delivered_at: nowIso })
        .eq("chat_id", chat.id)
        .neq("sender_id", userId)
        .is("delivered_at", null);
    }

    const messages = await Promise.all(
      pageRows.map(async (m) => {
        let imageUrl: string | null = null;
        if (m.image_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("chat-photos")
            .createSignedUrl(m.image_path, 60 * 60);
          imageUrl = signed?.signedUrl ?? null;
        }
        const isMine = m.sender_id === userId;
        return {
          id: m.id,
          sender_id: m.sender_id,
          body: m.body,
          image_url: imageUrl,
          created_at: m.created_at,
          from_me: isMine,
          // Для собственных сообщений отдаём фактические отметки;
          // для входящих подмешиваем свежие значения, если только что их проставили.
          delivered_at: isMine ? m.delivered_at : (m.delivered_at ?? nowIso),
          read_at: isMine ? m.read_at : (isInitial ? (m.read_at ?? nowIso) : m.read_at),
        };
      }),
    );


    return {
      chat: isInitial
        ? {
            id: chat.id,
            role: chat.buyer_id === userId ? ("buyer" as const) : ("seller" as const),
            other: { id: otherId, full_name: other?.full_name ?? "Пользователь" },
            product: product.data ?? null,
            order_id: chat.order_id,
          }
        : null,
      messages,
      hasMore,
      nextCursor: pageRows.length > 0 ? pageRows[0].created_at : null,
    };
  });

// Отправка сообщения (текст и/или картинка)
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
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
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tag = `[chat.send chat=${data.chat_id} user=${userId}]`;
    console.log(`${tag} start`, {
      has_body: !!data.body,
      body_len: data.body?.length ?? 0,
      has_image: !!data.image_path,
      image_path: data.image_path ?? null,
    });

    // Явная проверка, что отправитель — участник чата (не полагаемся только на RLS)
    const { data: chat, error: chatErr } = await supabaseAdmin
      .from("chats")
      .select("id, buyer_id, seller_id")
      .eq("id", data.chat_id)
      .single();
    if (chatErr || !chat) {
      console.error(`${tag} chat lookup failed`, chatErr);
      throw new Error(`Чат не найден: ${chatErr?.message ?? "нет доступа"}`);
    }
    if (chat.buyer_id !== userId && chat.seller_id !== userId) {
      console.error(`${tag} access denied`, { buyer: chat.buyer_id, seller: chat.seller_id });
      throw new Error("Нет доступа к чату");
    }

    const body = data.body?.trim() || null;
    const { error } = await supabaseAdmin.from("chat_messages").insert({
      chat_id: data.chat_id,
      sender_id: userId,
      body,
      image_path: data.image_path ?? null,
    });
    if (error) {
      console.error(`${tag} insert failed`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(
        `Не удалось отправить: ${error.message}${error.hint ? ` (${error.hint})` : ""}`,
      );
    }
    const { error: bumpErr } = await supabaseAdmin
      .from("chats")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", data.chat_id);
    if (bumpErr) console.warn(`${tag} bump last_message_at failed`, bumpErr);
    console.log(`${tag} ok`);
    return { ok: true };
  });

// Количество непрочитанных сообщений — для бейджа в шапке
export const getUnreadChatCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: chats } = await supabaseAdmin
      .from("chats")
      .select("id")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
    const chatIds = (chats ?? []).map((c) => c.id);
    if (chatIds.length === 0) return { count: 0 };
    const { count } = await supabaseAdmin
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .in("chat_id", chatIds)
      .neq("sender_id", userId)
      .is("read_at", null);
    return { count: count ?? 0 };
  });

// Отметить входящие сообщения чата доставленными (без пометки «прочитано»).
// Вызывается получателем, когда его клиент активен и получает realtime-INSERT.
export const markChatDelivered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ chat_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: chat, error: chatErr } = await supabaseAdmin
      .from("chats")
      .select("id, buyer_id, seller_id")
      .eq("id", data.chat_id)
      .single();
    if (chatErr || !chat) throw new Error("Чат не найден");
    if (chat.buyer_id !== userId && chat.seller_id !== userId) throw new Error("Нет доступа");
    await supabaseAdmin
      .from("chat_messages")
      .update({ delivered_at: new Date().toISOString() })
      .eq("chat_id", data.chat_id)
      .neq("sender_id", userId)
      .is("delivered_at", null);
    return { ok: true };
  });

