
-- 1) Products moderation bypass
DROP POLICY IF EXISTS products_public_active ON public.products;

CREATE OR REPLACE FUNCTION public.products_protect_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.moderation_status := OLD.moderation_status;
  NEW.moderation_reason := OLD.moderation_reason;
  NEW.moderated_by := OLD.moderated_by;
  NEW.moderated_at := OLD.moderated_at;
  IF OLD.moderation_status IS DISTINCT FROM 'approved' THEN
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_protect_moderation ON public.products;
CREATE TRIGGER trg_products_protect_moderation
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_protect_moderation();

-- 2) Seller profiles: restrict PII to authenticated users
DROP POLICY IF EXISTS sp_select_public ON public.seller_profiles;
REVOKE SELECT ON public.seller_profiles FROM anon;

CREATE POLICY sp_select_authenticated ON public.seller_profiles
  FOR SELECT TO authenticated
  USING (true);

-- 3) Return photos: uploader must be a party to the order_item
DROP POLICY IF EXISTS return_photos_authed_insert ON storage.objects;

CREATE POLICY return_photos_insert_parties ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'return-photos'
    AND EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE (oi.seller_id = auth.uid() OR o.buyer_id = auth.uid())
        AND storage.objects.name LIKE (oi.id::text || '/%')
    )
  );
