CREATE OR REPLACE FUNCTION public.find_order_id_by_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id FROM public.orders o
  WHERE replace(o.id::text, '-', '') ILIKE replace(trim(_code), '-', '') || '%'
  ORDER BY o.created_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.find_order_id_by_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_order_id_by_code(text) TO service_role;