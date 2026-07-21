
-- 1) Force pending moderation on seller inserts
ALTER TABLE public.products ALTER COLUMN moderation_status SET DEFAULT 'pending';

DROP POLICY IF EXISTS products_seller_insert ON public.products;
CREATE POLICY products_seller_insert ON public.products
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = seller_id
  AND has_role(auth.uid(), 'seller'::app_role)
  AND moderation_status = 'pending'
  AND is_active = false
);

-- 2) Reviews: verify the buyer actually purchased that order_item
DROP POLICY IF EXISTS reviews_insert_own ON public.reviews;
CREATE POLICY reviews_insert_own ON public.reviews
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = reviews.order_item_id
      AND oi.product_id = reviews.product_id
      AND o.buyer_id = auth.uid()
  )
);
