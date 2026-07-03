
-- Revoke direct INSERT on orders/order_items from authenticated users
-- Orders must be created through the createOrder server function (service role)
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
DROP POLICY IF EXISTS "orders_buyer_insert" ON public.orders;
DROP POLICY IF EXISTS "order_items_insert_own" ON public.order_items;
DROP POLICY IF EXISTS "order_items_buyer_insert" ON public.order_items;

REVOKE INSERT ON public.orders FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM authenticated, anon;
