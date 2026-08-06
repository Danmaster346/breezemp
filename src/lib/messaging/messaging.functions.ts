// Серверные функции новой системы сообщений.
// Все записи идут через сервис-роль после проверки участия пользователя в диалоге.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type {
  ChatMessage,
  ConversationHeader,
  ConversationSummary,
  MessageContext,
} from "@/lib/messaging/types";

const MIN_GAP_MS = 1200;
const HOURLY_LIMIT = 80;
const PAGE_SIZE = 30;

const attachmentSchema = z.object({
  storage_path: z.string().min(1).max(400),
  mime: z.string().min(1).max(120),
  size_bytes: z.number().int().min(0).max(10 * 1024 * 1024),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

/** Проверка участия + возврат роли. */
async function requireParticipant(db: Admin, conversationId: string, userId: string) {
  const { data } = await db
    .from("conversation_participants")
    .select("id, role")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("[NOT_PARTICIPANT] Нет доступа к диалогу");
  return data as { id: string; role: "buyer" | "seller" | "support" };
}

async function ensureNotBlocked(db: Admin, userId: string) {
  const { data } = await db.from("profiles").select("is_blocked").eq("id", userId).maybeSingle();
  if (data?.is_blocked) throw new Error("[BLOCKED] Отправка заблокирована");
}

async function checkRateLimit(db: Admin, userId: string) {
  const { data: recent } = await db
    .from("messages")
    .select("created_at")
    .eq("sender_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent?.created_at && Date.now() - new Date(recent.created_at).getTime() < MIN_GAP_MS) {
    throw new Error("[TOO_FAST] Слишком часто");
  }
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", userId)
    .gte("created_at", since);
  if ((count ?? 0) >= HOURLY_LIMIT) throw new Error("[HOURLY_LIMIT] Лимит сообщений в час");
}

// ============ Список диалогов ============

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversationSummary[]> => {
    const db = await admin();
    const { userId } = context;

    const { data: parts } = await db
      .from("conversation_participants")
      .select("conversation_id, role, unread_count, is_pinned, is_archived, muted")
      .eq("user_id", userId);
    const rows = parts ?? [];
    if (!rows.length) return [];

    const ids = rows.map((r) => r.conversation_id);
    const { data: convs } = await db
      .from("conversations")
      .select(
        "id, kind, buyer_id, seller_id, support_status, last_message_at, last_message_preview, last_sender_id, subject_order_id",
      )
      .in("id", ids);

    const peerIds = new Set<string>();
    for (const c of convs ?? []) {
      const peer = c.buyer_id === userId ? c.seller_id : c.buyer_id;
      if (peer) peerIds.add(peer);
    }
    const peerList = [...peerIds];
    const [{ data: profiles }, { data: shops }] = await Promise.all([
      peerList.length
        ? db.from("profiles").select("id, full_name").in("id", peerList)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      peerList.length
        ? db.from("seller_profiles").select("user_id, shop_name, logo_path").in("user_id", peerList)
        : Promise.resolve({ data: [] as { user_id: string; shop_name: string | null; logo_path: string | null }[] }),
    ]);
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const shopById = new Map((shops ?? []).map((s) => [s.user_id, s]));

    const partByConv = new Map(rows.map((r) => [r.conversation_id, r]));

    const logoUrl = (path: string | null | undefined) =>
      path
        ? db.storage.from("store-logos").getPublicUrl(path).data.publicUrl ?? null
        : null;

    const result: ConversationSummary[] = (convs ?? []).map((c) => {
      const p = partByConv.get(c.id)!;
      const peer = c.buyer_id === userId ? c.seller_id : c.buyer_id;
      const shop = peer ? shopById.get(peer) : undefined;
      const name =
        c.kind === "support"
          ? "Поддержка Kupiks"
          : shop?.shop_name || nameById.get(peer ?? "") || "Пользователь";
      return {
        id: c.id,
        kind: c.kind as ConversationSummary["kind"],
        peer_id: peer ?? null,
        peer_name: name,
        peer_logo_url: c.kind === "support" ? null : logoUrl(shop?.logo_path),
        my_role: p.role as ConversationSummary["my_role"],
        unread: p.unread_count ?? 0,
        is_pinned: p.is_pinned,
        is_archived: p.is_archived,
        muted: p.muted,
        last_message_at: c.last_message_at,
        last_message_preview: c.last_message_preview,
        last_sender_id: c.last_sender_id,
        support_status: c.support_status as ConversationSummary["support_status"],
        has_orders: !!c.subject_order_id,
      };
    });

    result.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return b.last_message_at.localeCompare(a.last_message_at);
    });
    return result;
  });

export const getUnreadMessageCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ count: number }> => {
    const db = await admin();
    const { data } = await db
      .from("conversation_participants")
      .select("unread_count")
      .eq("user_id", context.userId);
    const count = (data ?? []).reduce((s, r) => s + (r.unread_count ?? 0), 0);
    return { count };
  });

// ============ Открытие диалога ============

async function findOrCreateDeal(db: Admin, buyerId: string, sellerId: string) {
  const { data: existing } = await db
    .from("conversations")
    .select("id")
    .eq("kind", "deal")
    .eq("buyer_id", buyerId)
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await db
    .from("conversations")
    .insert({ kind: "deal", buyer_id: buyerId, seller_id: sellerId })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Не удалось создать диалог");

  await db.from("conversation_participants").insert([
    { conversation_id: created.id, user_id: buyerId, role: "buyer" },
    { conversation_id: created.id, user_id: sellerId, role: "seller" },
  ]);
  return created.id as string;
}

/**
 * Открывает единственный диалог пары «покупатель — продавец».
 * Контекст (товар/заказ) не создаёт новый диалог — он подставляется в сообщение.
 */
export const openConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        seller_id: z.string().uuid().optional(),
        product_id: z.string().uuid().optional(),
        order_item_id: z.string().uuid().optional(),
        support: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const db = await admin();
    const { userId } = context;

    // Поддержка
    if (data.support) {
      const { data: existing } = await db
        .from("conversations")
        .select("id")
        .eq("kind", "support")
        .eq("buyer_id", userId)
        .maybeSingle();
      if (existing) return { id: existing.id };
      const { data: created, error } = await db
        .from("conversations")
        .insert({ kind: "support", buyer_id: userId })
        .select("id")
        .single();
      if (error || !created) throw new Error("Не удалось открыть обращение");
      await db
        .from("conversation_participants")
        .insert({ conversation_id: created.id, user_id: userId, role: "buyer" });
      return { id: created.id };
    }

    // По позиции заказа: участники определяются заказом (работает для обеих ролей)
    if (data.order_item_id) {
      const { data: item } = await db
        .from("order_items")
        .select("id, order_id, seller_id")
        .eq("id", data.order_item_id)
        .maybeSingle();
      if (!item) throw new Error("Позиция заказа не найдена");
      const { data: order } = await db
        .from("orders")
        .select("id, buyer_id")
        .eq("id", item.order_id)
        .maybeSingle();
      if (!order) throw new Error("Заказ не найден");
      if (order.buyer_id !== userId && item.seller_id !== userId) {
        throw new Error("[NOT_PARTICIPANT] Нет доступа к заказу");
      }
      const id = await findOrCreateDeal(db, order.buyer_id, item.seller_id);
      await db.from("conversations").update({ subject_order_id: order.id }).eq("id", id);
      return { id };
    }

    // По товару / продавцу
    let sellerId = data.seller_id ?? null;
    if (data.product_id) {
      const { data: product } = await db
        .from("products")
        .select("id, seller_id")
        .eq("id", data.product_id)
        .maybeSingle();
      if (!product) throw new Error("Товар не найден");
      sellerId = product.seller_id;
    }
    if (!sellerId) throw new Error("Не указан получатель");
    if (sellerId === userId) throw new Error("Нельзя написать самому себе");

    const id = await findOrCreateDeal(db, userId, sellerId);
    if (data.product_id) {
      await db.from("conversations").update({ subject_product_id: data.product_id }).eq("id", id);
    }
    return { id };
  });

// ============ Чтение диалога ============

export const getConversationHeader = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ConversationHeader> => {
    const db = await admin();
    const { userId } = context;
    const me = await requireParticipant(db, data.conversation_id, userId);

    const { data: conv } = await db
      .from("conversations")
      .select("id, kind, buyer_id, seller_id, support_status")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (!conv) throw new Error("Диалог не найден");

    const peer = conv.buyer_id === userId ? conv.seller_id : conv.buyer_id;
    let peerName = conv.kind === "support" ? "Поддержка Kupiks" : "Пользователь";
    let logo: string | null = null;
    if (peer && conv.kind !== "support") {
      const [{ data: prof }, { data: shop }] = await Promise.all([
        db.from("profiles").select("full_name").eq("id", peer).maybeSingle(),
        db.from("seller_profiles").select("shop_name, logo_path").eq("user_id", peer).maybeSingle(),
      ]);
      peerName = shop?.shop_name || prof?.full_name || "Пользователь";
      logo = shop?.logo_path
        ? db.storage.from("store-logos").getPublicUrl(shop.logo_path).data.publicUrl ?? null
        : null;
    }

    const { data: peerPart } = await db
      .from("conversation_participants")
      .select("typing_at")
      .eq("conversation_id", data.conversation_id)
      .neq("user_id", userId)
      .order("typing_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const typing =
      !!peerPart?.typing_at && Date.now() - new Date(peerPart.typing_at).getTime() < 6000;

    return {
      id: conv.id,
      kind: conv.kind as ConversationHeader["kind"],
      peer_id: peer ?? null,
      peer_name: peerName,
      peer_logo_url: logo,
      my_role: me.role,
      support_status: conv.support_status as ConversationHeader["support_status"],
      peer_typing: typing,
    };
  });

async function hydrateMessages(
  db: Admin,
  rows: {
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string | null;
    reply_to_id: string | null;
    context_type: string | null;
    context_id: string | null;
    is_system: boolean;
    created_at: string;
    edited_at: string | null;
    deleted_at: string | null;
    delivered_at: string | null;
    read_at: string | null;
  }[],
): Promise<ChatMessage[]> {
  if (!rows.length) return [];

  const senderIds = [...new Set(rows.map((r) => r.sender_id))];
  const replyIds = [...new Set(rows.map((r) => r.reply_to_id).filter(Boolean))] as string[];
  const productIds = [
    ...new Set(rows.filter((r) => r.context_type === "product").map((r) => r.context_id)),
  ].filter(Boolean) as string[];
  const orderIds = [
    ...new Set(rows.filter((r) => r.context_type === "order").map((r) => r.context_id)),
  ].filter(Boolean) as string[];

  const [{ data: profiles }, { data: replies }, { data: products }, { data: orders }, { data: files }] =
    await Promise.all([
      db.from("profiles").select("id, full_name").in("id", senderIds),
      replyIds.length
        ? db.from("messages").select("id, body, sender_id").in("id", replyIds)
        : Promise.resolve({ data: [] as { id: string; body: string | null; sender_id: string }[] }),
      productIds.length
        ? db.from("products").select("id, title, image_url, price_kopecks").in("id", productIds)
        : Promise.resolve({ data: [] as { id: string; title: string; image_url: string | null; price_kopecks: number }[] }),
      orderIds.length
        ? db.from("orders").select("id, total_kopecks").in("id", orderIds)
        : Promise.resolve({ data: [] as { id: string; total_kopecks: number }[] }),
      db
        .from("message_attachments")
        .select("id, message_id, storage_path, mime, size_bytes")
        .in("message_id", rows.map((r) => r.id)),
    ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name || "Пользователь"]));
  const replyById = new Map((replies ?? []).map((r) => [r.id, r]));
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const orderById = new Map((orders ?? []).map((o) => [o.id, o]));
  const filesByMsg = new Map<string, ChatMessage["attachments"]>();
  for (const f of files ?? []) {
    const list = filesByMsg.get(f.message_id) ?? [];
    list.push({ id: f.id, storage_path: f.storage_path, mime: f.mime, size_bytes: f.size_bytes });
    filesByMsg.set(f.message_id, list);
  }

  return rows.map((r) => {
    let ctx: MessageContext = null;
    if (r.context_type === "product" && r.context_id) {
      const p = productById.get(r.context_id);
      if (p)
        ctx = {
          type: "product",
          id: p.id,
          title: p.title,
          image_url: p.image_url,
          price_kopecks: p.price_kopecks,
        };
    } else if (r.context_type === "order" && r.context_id) {
      const o = orderById.get(r.context_id);
      ctx = {
        type: "order",
        id: r.context_id,
        title: `Заказ №${r.context_id.slice(0, 8).toUpperCase()}`,
        total_kopecks: o?.total_kopecks ?? null,
      };
    }
    const reply = r.reply_to_id ? replyById.get(r.reply_to_id) : undefined;
    return {
      id: r.id,
      conversation_id: r.conversation_id,
      sender_id: r.sender_id,
      sender_name: nameById.get(r.sender_id) ?? "Пользователь",
      body: r.deleted_at ? null : r.body,
      reply_to_id: r.reply_to_id,
      reply_preview: reply ? (reply.body ?? "Вложение").slice(0, 120) : null,
      reply_sender_name: reply ? nameById.get(reply.sender_id) ?? "Пользователь" : null,
      context: ctx,
      attachments: r.deleted_at ? [] : filesByMsg.get(r.id) ?? [],
      is_system: r.is_system,
      created_at: r.created_at,
      edited_at: r.edited_at,
      deleted_at: r.deleted_at,
      delivered_at: r.delivered_at,
      read_at: r.read_at,
    };
  });
}

const MESSAGE_COLUMNS =
  "id, conversation_id, sender_id, body, reply_to_id, context_type, context_id, is_system, created_at, edited_at, deleted_at, delivered_at, read_at";

/** Пагинация вверх: последние сообщения старше `before`. */
export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        before: z.string().optional(),
        limit: z.number().int().min(1).max(60).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
    const db = await admin();
    await requireParticipant(db, data.conversation_id, context.userId);
    const limit = data.limit ?? PAGE_SIZE;

    let q = db
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("conversation_id", data.conversation_id)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (data.before) q = q.lt("created_at", data.before);

    const { data: rowsDesc, error } = await q;
    if (error) throw new Error(error.message);
    const all = rowsDesc ?? [];
    const hasMore = all.length > limit;
    const page = (hasMore ? all.slice(0, limit) : all).slice().reverse();

    // Отмечаем доставку чужих сообщений
    const undelivered = page.filter((r) => r.sender_id !== context.userId && !r.delivered_at);
    if (undelivered.length) {
      await db
        .from("messages")
        .update({ delivered_at: new Date().toISOString() })
        .in("id", undelivered.map((r) => r.id));
    }

    return { messages: await hydrateMessages(db, page), hasMore };
  });

// ============ Отправка / изменение ============

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        body: z.string().max(4000).optional(),
        reply_to_id: z.string().uuid().optional(),
        context_type: z.enum(["product", "order"]).optional(),
        context_id: z.string().uuid().optional(),
        attachments: z.array(attachmentSchema).max(5).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ message: ChatMessage }> => {
    const db = await admin();
    const { userId } = context;
    await requireParticipant(db, data.conversation_id, userId);
    await ensureNotBlocked(db, userId);

    const body = (data.body ?? "").trim();
    const attachments = data.attachments ?? [];
    if (!body && !attachments.length) throw new Error("[EMPTY] Пустое сообщение");
    await checkRateLimit(db, userId);

    const { data: created, error } = await db
      .from("messages")
      .insert({
        conversation_id: data.conversation_id,
        sender_id: userId,
        body: body || null,
        reply_to_id: data.reply_to_id ?? null,
        context_type: data.context_type ?? null,
        context_id: data.context_id ?? null,
      })
      .select(MESSAGE_COLUMNS)
      .single();
    if (error || !created) throw new Error(error?.message ?? "Не удалось отправить");

    if (attachments.length) {
      const { error: attErr } = await db.from("message_attachments").insert(
        attachments.map((a) => ({
          message_id: created.id,
          storage_path: a.storage_path,
          mime: a.mime,
          size_bytes: a.size_bytes,
          width: a.width ?? null,
          height: a.height ?? null,
        })),
      );
      if (attErr) console.error("[messages] attachments insert failed", attErr);
    }

    await maybeAutoReply(db, data.conversation_id, userId);

    const [msg] = await hydrateMessages(db, [created]);
    return { message: msg! };
  });

/** Автоответ продавца вне рабочих часов (одна отправка в 6 часов). */
async function maybeAutoReply(db: Admin, conversationId: string, senderId: string) {
  const { data: conv } = await db
    .from("conversations")
    .select("kind, buyer_id, seller_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv || conv.kind !== "deal" || !conv.seller_id) return;
  if (senderId !== conv.buyer_id) return;

  const { data: sp } = await db
    .from("seller_profiles")
    .select("autoreply_enabled, autoreply_text, work_hours_from, work_hours_to")
    .eq("user_id", conv.seller_id)
    .maybeSingle();
  if (!sp?.autoreply_enabled || !sp.autoreply_text) return;

  const hour = new Date().getUTCHours() + 3; // Москва
  const h = ((hour % 24) + 24) % 24;
  const from = sp.work_hours_from ?? 9;
  const to = sp.work_hours_to ?? 21;
  const working = from <= to ? h >= from && h < to : h >= from || h < to;
  if (working) return;

  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("sender_id", conv.seller_id)
    .eq("is_system", true)
    .gte("created_at", since);
  if ((count ?? 0) > 0) return;

  await db.from("messages").insert({
    conversation_id: conversationId,
    sender_id: conv.seller_id,
    body: sp.autoreply_text,
    is_system: true,
  });
}

export const editMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z.object({ message_id: z.string().uuid(), body: z.string().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await admin();
    const { data: msg } = await db
      .from("messages")
      .select("id, sender_id, created_at")
      .eq("id", data.message_id)
      .maybeSingle();
    if (!msg || msg.sender_id !== context.userId) throw new Error("[NOT_PARTICIPANT] Нет доступа");
    if (Date.now() - new Date(msg.created_at).getTime() > 15 * 60 * 1000) {
      throw new Error("[EDIT_WINDOW] Окно редактирования истекло");
    }
    const { error } = await db
      .from("messages")
      .update({ body: data.body.trim(), edited_at: new Date().toISOString() })
      .eq("id", data.message_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ message_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await admin();
    const { data: msg } = await db
      .from("messages")
      .select("id, sender_id")
      .eq("id", data.message_id)
      .maybeSingle();
    if (!msg || msg.sender_id !== context.userId) throw new Error("[NOT_PARTICIPANT] Нет доступа");
    const { error } = await db
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), body: null })
      .eq("id", data.message_id);
    if (error) throw new Error(error.message);
    await db.from("message_attachments").delete().eq("message_id", data.message_id);
    return { ok: true };
  });

// ============ Прочтение, печатает, настройки диалога ============

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await admin();
    const { userId } = context;
    await requireParticipant(db, data.conversation_id, userId);
    const now = new Date().toISOString();

    await db
      .from("conversation_participants")
      .update({ unread_count: 0, last_read_at: now })
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", userId);

    await db
      .from("messages")
      .update({ read_at: now, delivered_at: now })
      .eq("conversation_id", data.conversation_id)
      .neq("sender_id", userId)
      .is("read_at", null);

    return { ok: true };
  });

export const setTyping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await admin();
    await db
      .from("conversation_participants")
      .update({ typing_at: new Date().toISOString() })
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const updateConversationFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        is_pinned: z.boolean().optional(),
        is_archived: z.boolean().optional(),
        muted: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await admin();
    const patch: Record<string, boolean> = {};
    if (typeof data.is_pinned === "boolean") patch.is_pinned = data.is_pinned;
    if (typeof data.is_archived === "boolean") patch.is_archived = data.is_archived;
    if (typeof data.muted === "boolean") patch.muted = data.muted;
    if (!Object.keys(patch).length) return { ok: true };
    await db
      .from("conversation_participants")
      .update(patch)
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

// ============ Жалоба ============

export const reportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        message_id: z.string().uuid(),
        reason: z.enum(["spam", "abuse", "fraud", "offsite", "other"]),
        comment: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await admin();
    const { data: msg } = await db
      .from("messages")
      .select("id, conversation_id, sender_id")
      .eq("id", data.message_id)
      .maybeSingle();
    if (!msg) throw new Error("Сообщение не найдено");
    await requireParticipant(db, msg.conversation_id, context.userId);
    if (msg.sender_id === context.userId) throw new Error("Нельзя жаловаться на своё сообщение");

    const { error } = await db.from("message_reports").insert({
      message_id: msg.id,
      conversation_id: msg.conversation_id,
      reporter_id: context.userId,
      reason: data.reason,
      comment: data.comment ?? null,
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

// ============ Быстрые ответы продавца ============

export const listQuickReplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; text: string; sort_order: number }[]> => {
    const db = await admin();
    const { data } = await db
      .from("seller_quick_replies")
      .select("id, text, sort_order")
      .eq("seller_id", context.userId)
      .order("sort_order");
    return data ?? [];
  });

export const saveQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        text: z.string().trim().min(1).max(300),
        sort_order: z.number().int().min(0).max(99).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await admin();
    if (data.id) {
      await db
        .from("seller_quick_replies")
        .update({ text: data.text, sort_order: data.sort_order ?? 0 })
        .eq("id", data.id)
        .eq("seller_id", context.userId);
    } else {
      await db.from("seller_quick_replies").insert({
        seller_id: context.userId,
        text: data.text,
        sort_order: data.sort_order ?? 0,
      });
    }
    return { ok: true };
  });

export const deleteQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await admin();
    await db
      .from("seller_quick_replies")
      .delete()
      .eq("id", data.id)
      .eq("seller_id", context.userId);
    return { ok: true };
  });

export const getAutoReplySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await admin();
    const { data } = await db
      .from("seller_profiles")
      .select("autoreply_enabled, autoreply_text, work_hours_from, work_hours_to")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      autoreply_enabled: data?.autoreply_enabled ?? false,
      autoreply_text: data?.autoreply_text ?? "",
      work_hours_from: data?.work_hours_from ?? 9,
      work_hours_to: data?.work_hours_to ?? 21,
    };
  });

export const saveAutoReplySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    z
      .object({
        autoreply_enabled: z.boolean(),
        autoreply_text: z.string().max(500),
        work_hours_from: z.number().int().min(0).max(23),
        work_hours_to: z.number().int().min(0).max(23),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await admin();
    const { error } = await db
      .from("seller_profiles")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
