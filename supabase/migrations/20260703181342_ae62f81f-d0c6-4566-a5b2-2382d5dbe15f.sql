-- 1) Prevent client-side insert of order_items with arbitrary commission/price
DROP POLICY IF EXISTS "order_items_insert" ON public.order_items;

-- 2) Allow sellers to read orders that contain their items (shipping info for fulfillment)
DROP POLICY IF EXISTS "orders_select_seller" ON public.orders;
CREATE POLICY "orders_select_seller" ON public.orders
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = orders.id AND oi.seller_id = auth.uid()
  )
);

-- 3) Remove public read on promo_codes; validation happens server-side via service role
DROP POLICY IF EXISTS "Anyone can read active promo codes" ON public.promo_codes;