
-- 1. Таблица чатов
CREATE TABLE public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_id <> seller_id)
);
CREATE UNIQUE INDEX chats_unique_pair_product
  ON public.chats (buyer_id, seller_id, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX chats_seller_idx ON public.chats (seller_id, last_message_at DESC);
CREATE INDEX chats_buyer_idx  ON public.chats (buyer_id, last_message_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can read"
  ON public.chats FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyer can create chat"
  ON public.chats FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Participants can update chat"
  ON public.chats FOR UPDATE TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE TRIGGER chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Сообщения
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text,
  image_path text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (body IS NOT NULL OR image_path IS NOT NULL)
);
CREATE INDEX chat_messages_chat_idx ON public.chat_messages (chat_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can read messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)
  ));

CREATE POLICY "Chat participants can send messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_id AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)
    )
  );

CREATE POLICY "Recipient can mark as read"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_id AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)
  ));

-- 3. Реалтайм
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;

-- 4. Политики storage для бакета chat-photos
CREATE POLICY "Users can upload chat photos to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated can read chat photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-photos');
