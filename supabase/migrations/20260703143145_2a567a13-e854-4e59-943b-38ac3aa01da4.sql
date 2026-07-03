DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;

CREATE POLICY "orders_select"
ON public.orders
FOR SELECT
TO authenticated
USING (auth.uid() = buyer_id);

CREATE POLICY "order_items_select"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  auth.uid() = seller_id
  OR EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.buyer_id = auth.uid()
  )
);

DROP FUNCTION IF EXISTS public.order_has_seller_item(uuid, uuid);
DROP FUNCTION IF EXISTS public.order_belongs_to_buyer(uuid, uuid);

GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;
GRANT ALL ON public.payouts TO service_role;
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.order_items FROM anon;
REVOKE ALL ON public.payouts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payouts FROM authenticated;