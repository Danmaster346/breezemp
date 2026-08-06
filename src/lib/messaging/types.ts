// Общие типы новой системы сообщений Kupiks.

export type ConversationKind = "deal" | "support";

export type ConversationSummary = {
  id: string;
  kind: ConversationKind;
  /** Собеседник (для поддержки — служебная запись). */
  peer_id: string | null;
  peer_name: string;
  peer_logo_url: string | null;
  my_role: "buyer" | "seller" | "support";
  unread: number;
  is_pinned: boolean;
  is_archived: boolean;
  muted: boolean;
  last_message_at: string;
  last_message_preview: string | null;
  last_sender_id: string | null;
  support_status: "new" | "in_progress" | "closed";
  has_orders: boolean;
};

export type MessageContext =
  | { type: "product"; id: string; title: string; image_url: string | null; price_kopecks: number | null }
  | { type: "order"; id: string; title: string; total_kopecks: number | null }
  | null;

export type MessageAttachment = {
  id: string;
  storage_path: string;
  mime: string;
  size_bytes: number;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  body: string | null;
  reply_to_id: string | null;
  reply_preview: string | null;
  reply_sender_name: string | null;
  context: MessageContext;
  attachments: MessageAttachment[];
  is_system: boolean;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
};

export type ConversationHeader = {
  id: string;
  kind: ConversationKind;
  peer_id: string | null;
  peer_name: string;
  peer_logo_url: string | null;
  my_role: "buyer" | "seller" | "support";
  support_status: "new" | "in_progress" | "closed";
  peer_typing: boolean;
};

/** Коды ошибок, которые UI переводит в понятный текст. */
export const MSG_ERRORS = {
  TOO_FAST: "TOO_FAST",
  HOURLY_LIMIT: "HOURLY_LIMIT",
  EMPTY: "EMPTY",
  NOT_PARTICIPANT: "NOT_PARTICIPANT",
  BLOCKED: "BLOCKED",
  EDIT_WINDOW: "EDIT_WINDOW",
} as const;

export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export function friendlyMessagingError(raw: unknown): string {
  const text = raw instanceof Error ? raw.message : String(raw ?? "");
  if (text.includes(MSG_ERRORS.TOO_FAST)) return "Слишком часто — подождите секунду";
  if (text.includes(MSG_ERRORS.HOURLY_LIMIT)) return "Слишком много сообщений за час. Попробуйте позже";
  if (text.includes(MSG_ERRORS.EMPTY)) return "Сообщение пустое";
  if (text.includes(MSG_ERRORS.NOT_PARTICIPANT)) return "Нет доступа к этому диалогу";
  if (text.includes(MSG_ERRORS.BLOCKED)) return "Отправка сообщений заблокирована";
  if (text.includes(MSG_ERRORS.EDIT_WINDOW)) return "Редактировать можно только 15 минут после отправки";
  if (/fetch|network|Failed/i.test(text)) return "Нет соединения. Сообщение отправится повторно";
  return "Не удалось отправить сообщение. Попробуйте ещё раз";
}
