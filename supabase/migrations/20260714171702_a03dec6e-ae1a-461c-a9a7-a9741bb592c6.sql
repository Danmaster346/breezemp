GRANT SELECT, INSERT, UPDATE ON public.chats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chats TO service_role;
GRANT ALL ON public.chat_messages TO service_role;

-- Ensure the intended participant-only policies exist and are up to date.
DROP POLICY IF EXISTS "Buyer can create chat" ON public.chats;
CREATE POLICY "Buyer can create chat"
ON public.chats
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = buyer_id AND buyer_id <> seller_id);

DROP POLICY IF EXISTS "Chat participants can read" ON public.chats;
CREATE POLICY "Chat participants can read"
ON public.chats
FOR SELECT
TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Participants can update chat" ON public.chats;
CREATE POLICY "Participants can update chat"
ON public.chats
FOR UPDATE
TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Chat participants can read messages" ON public.chat_messages;
CREATE POLICY "Chat participants can read messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chats c
    WHERE c.id = chat_messages.chat_id
      AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)
  )
);

DROP POLICY IF EXISTS "Chat participants can send messages" ON public.chat_messages;
CREATE POLICY "Chat participants can send messages"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1
    FROM public.chats c
    WHERE c.id = chat_messages.chat_id
      AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)
  )
);

DROP POLICY IF EXISTS "Recipient can mark as read" ON public.chat_messages;
CREATE POLICY "Recipient can mark as read"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chats c
    WHERE c.id = chat_messages.chat_id
      AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chats c
    WHERE c.id = chat_messages.chat_id
      AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)
  )
);