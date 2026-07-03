-- Restore Data API read access required by RLS-protected account pages
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;
GRANT ALL ON public.payouts TO service_role;

-- Keep client-side writes blocked; order creation/status/payout writes go through server functions
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.order_items FROM anon;
REVOKE ALL ON public.payouts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payouts FROM authenticated;

-- Security-definer helpers avoid recursive RLS checks between orders and order_items
CREATE OR REPLACE FUNCTION public.order_has_seller_item(_order_id uuid, _seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.order_id = _order_id
      AND oi.seller_id = _seller_id
  );
$$;

CREATE OR REPLACE FUNCTION public.order_belongs_to_buyer(_order_id uuid, _buyer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = _order_id
      AND o.buyer_id = _buyer_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.order_has_seller_item(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.order_belongs_to_buyer(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;

CREATE POLICY "orders_select"
ON public.orders
FOR SELECT
TO authenticated
USING (
  auth.uid() = buyer_id
  OR public.order_has_seller_item(id, auth.uid())
);

CREATE POLICY "order_items_select"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  auth.uid() = seller_id
  OR public.order_belongs_to_buyer(order_id, auth.uid())
);