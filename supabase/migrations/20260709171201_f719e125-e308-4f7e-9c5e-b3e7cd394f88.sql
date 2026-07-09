
-- seller_profiles: restrict SELECT to owner + admins
DROP POLICY IF EXISTS sp_select_authenticated ON public.seller_profiles;
CREATE POLICY sp_select_own ON public.seller_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- return-photos: strict folder match
DROP POLICY IF EXISTS return_photos_insert_parties ON storage.objects;
DROP POLICY IF EXISTS return_photos_select_parties ON storage.objects;
DROP POLICY IF EXISTS return_photos_authed_insert ON storage.objects;

CREATE POLICY return_photos_insert_strict ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'return-photos'
    AND EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE (storage.foldername(objects.name))[1] = oi.id::text
        AND (oi.seller_id = auth.uid() OR o.buyer_id = auth.uid())
    )
  );

CREATE POLICY return_photos_select_strict ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'return-photos'
    AND EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE (storage.foldername(objects.name))[1] = oi.id::text
        AND (oi.seller_id = auth.uid() OR o.buyer_id = auth.uid())
    )
  );

-- products: additionally guard seller UPDATE at policy level (trigger also reverts).
DROP POLICY IF EXISTS products_seller_update ON public.products;
CREATE POLICY products_seller_update ON public.products
  FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'))
  WITH CHECK (
    auth.uid() = seller_id
    AND public.has_role(auth.uid(), 'seller')
    AND moderation_status <> 'blocked'
  );

-- Revoke EXECUTE on internal SECURITY DEFINER functions from public/anon/authenticated.
REVOKE ALL ON FUNCTION public.consume_promo_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrement_product_stock(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_product_stock(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.products_protect_moderation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role is used by RLS policies for both anon and authenticated; keep EXECUTE granted.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
