
CREATE OR REPLACE FUNCTION public.increment_product_stock(_product_id uuid, _qty integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _qty <= 0 THEN RETURN; END IF;
  UPDATE public.products SET stock = stock + _qty WHERE id = _product_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.increment_product_stock(uuid, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.increment_product_stock(uuid, integer) FROM anon, authenticated, public;
