// Серверный хелпер: системное сообщение в диалог пары «покупатель — продавец».
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function postSystemMessage(params: {
  buyerId: string;
  sellerId: string;
  senderId: string;
  body: string;
  orderId?: string | null;
}) {
  const db = supabaseAdmin;
  let conversationId: string | null = null;

  const { data: existing } = await db
    .from("conversations")
    .select("id")
    .eq("kind", "deal")
    .eq("buyer_id", params.buyerId)
    .eq("seller_id", params.sellerId)
    .maybeSingle();

  if (existing) {
    conversationId = existing.id;
  } else {
    const { data: created } = await db
      .from("conversations")
      .insert({ kind: "deal", buyer_id: params.buyerId, seller_id: params.sellerId })
      .select("id")
      .maybeSingle();
    if (!created) return;
    conversationId = created.id;
    await db.from("conversation_participants").insert([
      { conversation_id: conversationId, user_id: params.buyerId, role: "buyer" },
      { conversation_id: conversationId, user_id: params.sellerId, role: "seller" },
    ]);
  }

  if (params.orderId) {
    await db.from("conversations").update({ subject_order_id: params.orderId }).eq("id", conversationId);
  }

  await db.from("messages").insert({
    conversation_id: conversationId,
    sender_id: params.senderId,
    body: params.body,
    is_system: true,
    context_type: params.orderId ? "order" : null,
    context_id: params.orderId ?? null,
  });
}
