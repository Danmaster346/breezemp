-- ============ 1. Таблицы ============

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'deal' CHECK (kind IN ('deal','support')),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  subject_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  support_status text NOT NULL DEFAULT 'new' CHECK (support_status IN ('new','in_progress','closed')),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  last_sender_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX conversations_deal_pair_uniq
  ON public.conversations (buyer_id, seller_id)
  WHERE kind = 'deal';
CREATE UNIQUE INDEX conversations_support_uniq
  ON public.conversations (buyer_id)
  WHERE kind = 'support';
CREATE INDEX conversations_last_message_idx ON public.conversations (last_message_at DESC);

CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','seller','support')),
  last_read_at timestamptz NOT NULL DEFAULT to_timestamp(0),
  unread_count integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  muted boolean NOT NULL DEFAULT false,
  typing_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
CREATE INDEX conversation_participants_user_idx ON public.conversation_participants (user_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text,
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  context_type text CHECK (context_type IN ('product','order','order_item')),
  context_id uuid,
  is_system boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  read_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at DESC);

CREATE TABLE public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes integer NOT NULL DEFAULT 0,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_attachments_message_idx ON public.message_attachments (message_id);

CREATE TABLE public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  comment text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','rejected')),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_id)
);

CREATE TABLE public.seller_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX seller_quick_replies_seller_idx ON public.seller_quick_replies (seller_id, sort_order);

ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS autoreply_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autoreply_text text,
  ADD COLUMN IF NOT EXISTS work_hours_from smallint NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS work_hours_to smallint NOT NULL DEFAULT 21;

-- ============ 2. GRANT ============

GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

GRANT SELECT, UPDATE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;

GRANT SELECT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

GRANT SELECT ON public.message_attachments TO authenticated;
GRANT ALL ON public.message_attachments TO service_role;

GRANT SELECT ON public.message_reports TO authenticated;
GRANT ALL ON public.message_reports TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_quick_replies TO authenticated;
GRANT ALL ON public.seller_quick_replies TO service_role;

-- ============ 3. Хелпер участника ============

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  )
$$;

-- ============ 4. RLS ============

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_select_participant" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_select_own_conversation" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cp_update_own_row" ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT TO authenticated
  USING (
    (public.is_conversation_participant(conversation_id, auth.uid()) AND is_hidden = false)
    OR public.has_role(auth.uid(), 'admin')
  );

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments_select_participant" ON public.message_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND (public.is_conversation_participant(m.conversation_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
    )
  );

ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_select_own_or_admin" ON public.message_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.seller_quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quick_replies_own" ON public.seller_quick_replies
  FOR ALL TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- ============ 5. Триггеры ============

CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER conversation_participants_updated_at BEFORE UPDATE ON public.conversation_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER message_reports_updated_at BEFORE UPDATE ON public.message_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER seller_quick_replies_updated_at BEFORE UPDATE ON public.seller_quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.messages_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
     SET last_message_at = NEW.created_at,
         last_message_preview = COALESCE(NULLIF(left(COALESCE(NEW.body,''), 160), ''), 'Вложение'),
         last_sender_id = NEW.sender_id,
         updated_at = now()
   WHERE id = NEW.conversation_id;

  UPDATE public.conversation_participants
     SET unread_count = unread_count + 1,
         is_archived = false,
         updated_at = now()
   WHERE conversation_id = NEW.conversation_id
     AND user_id <> NEW.sender_id;

  RETURN NEW;
END; $$;

CREATE TRIGGER messages_after_insert_trg AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_after_insert();

-- ============ 6. Перенос старых переписок ============

-- Диалоги: одна пара покупатель–продавец
INSERT INTO public.conversations (buyer_id, seller_id, kind, last_message_at, created_at)
SELECT c.buyer_id, c.seller_id, 'deal', MAX(c.last_message_at), MIN(c.created_at)
  FROM public.chats c
 GROUP BY c.buyer_id, c.seller_id
ON CONFLICT DO NOTHING;

-- Участники
INSERT INTO public.conversation_participants (conversation_id, user_id, role)
SELECT nc.id, nc.buyer_id, 'buyer' FROM public.conversations nc WHERE nc.kind = 'deal'
ON CONFLICT DO NOTHING;
INSERT INTO public.conversation_participants (conversation_id, user_id, role)
SELECT nc.id, nc.seller_id, 'seller' FROM public.conversations nc WHERE nc.kind = 'deal' AND nc.seller_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Сообщения (триггер отключаем, чтобы не портить счётчики)
ALTER TABLE public.messages DISABLE TRIGGER messages_after_insert_trg;

INSERT INTO public.messages
  (conversation_id, sender_id, body, context_type, context_id, delivered_at, read_at, created_at)
SELECT nc.id,
       m.sender_id,
       m.body,
       CASE WHEN c.product_id IS NOT NULL THEN 'product' WHEN c.order_id IS NOT NULL THEN 'order' END,
       COALESCE(c.product_id, c.order_id),
       m.delivered_at,
       m.read_at,
       m.created_at
  FROM public.chat_messages m
  JOIN public.chats c ON c.id = m.chat_id
  JOIN public.conversations nc
    ON nc.kind = 'deal' AND nc.buyer_id = c.buyer_id AND nc.seller_id = c.seller_id;

ALTER TABLE public.messages ENABLE TRIGGER messages_after_insert_trg;

-- Пересчёт счётчиков и превью
UPDATE public.conversations nc
   SET last_message_at = COALESCE(lm.created_at, nc.last_message_at),
       last_message_preview = COALESCE(NULLIF(left(COALESCE(lm.body,''), 160), ''), 'Вложение'),
       last_sender_id = lm.sender_id
  FROM (
    SELECT DISTINCT ON (conversation_id) conversation_id, body, sender_id, created_at
      FROM public.messages ORDER BY conversation_id, created_at DESC
  ) lm
 WHERE lm.conversation_id = nc.id;

UPDATE public.conversation_participants cp
   SET unread_count = sub.cnt
  FROM (
    SELECT p.id AS pid, COUNT(m.id) AS cnt
      FROM public.conversation_participants p
      LEFT JOIN public.messages m
        ON m.conversation_id = p.conversation_id
       AND m.sender_id <> p.user_id
       AND m.read_at IS NULL
     GROUP BY p.id
  ) sub
 WHERE sub.pid = cp.id;

-- ============ 7. Realtime ============

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;