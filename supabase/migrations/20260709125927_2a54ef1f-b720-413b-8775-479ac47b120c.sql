
DROP POLICY IF EXISTS "return_photos_authed_insert" ON storage.objects;
CREATE POLICY "return_photos_authed_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'return-photos');

DROP POLICY IF EXISTS "return_photos_select_parties" ON storage.objects;
CREATE POLICY "return_photos_select_parties" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'return-photos'
    AND EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE (oi.seller_id = auth.uid() OR o.buyer_id = auth.uid())
        AND (storage.objects.name LIKE oi.id::text || '/%')
    )
  );
