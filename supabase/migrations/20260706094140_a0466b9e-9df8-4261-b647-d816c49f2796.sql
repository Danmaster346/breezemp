-- Fix orders_shipping_data_exposure: remove direct seller SELECT on orders (PII).
-- Sellers already fetch order data through the server function getSellerOrderItems (service-role, filtered by their seller_id).
DROP POLICY IF EXISTS orders_select_seller ON public.orders;

-- Fix products_seller_insert_no_role_check_on_update: enforce seller role for UPDATE/DELETE, matching INSERT.
DROP POLICY IF EXISTS products_seller_update ON public.products;
DROP POLICY IF EXISTS products_seller_delete ON public.products;

CREATE POLICY products_seller_update ON public.products
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'::app_role))
  WITH CHECK (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'::app_role));

CREATE POLICY products_seller_delete ON public.products
  FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id AND public.has_role(auth.uid(), 'seller'::app_role));