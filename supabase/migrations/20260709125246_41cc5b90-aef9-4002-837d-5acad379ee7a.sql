
-- 1) chat-photos: only chat participants can read
DROP POLICY IF EXISTS "Authenticated can read chat photos" ON storage.objects;
DROP POLICY IF EXISTS "chat_photos_select_participants" ON storage.objects;

CREATE POLICY "chat_photos_select_participants"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-photos'
  AND EXISTS (
    SELECT 1
    FROM public.chat_messages m
    JOIN public.chats c ON c.id = m.chat_id
    WHERE m.image_path = storage.objects.name
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
  )
);

-- 2) review-photos: publicly readable (reviews are public), scoped to bucket
DROP POLICY IF EXISTS "review_photos_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "review_photos_select_public" ON storage.objects;

CREATE POLICY "review_photos_select_public"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'review-photos');
