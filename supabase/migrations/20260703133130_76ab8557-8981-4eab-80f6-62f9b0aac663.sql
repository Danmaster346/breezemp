
-- 1) Remove permissive INSERT on payouts; server function will insert via service role
DROP POLICY IF EXISTS "Sellers create own payouts" ON public.payouts;

-- 2) Defense-in-depth: explicitly deny UPDATE/DELETE on user_roles for all client roles
CREATE POLICY "user_roles_no_update" ON public.user_roles
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "user_roles_no_delete" ON public.user_roles
  AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (false);
