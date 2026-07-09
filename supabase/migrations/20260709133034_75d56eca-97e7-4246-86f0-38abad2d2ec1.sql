
-- Admin panel: add fields, tables, RLS
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS return_admin_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS return_admin_reason text;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icon_url text;

-- Admin logs
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read logs" ON public.admin_logs;
CREATE POLICY "Admins can read logs" ON public.admin_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin read-all policies for management surfaces
DROP POLICY IF EXISTS "Admins read all products" ON public.products;
CREATE POLICY "Admins read all products" ON public.products
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read all orders" ON public.orders;
CREATE POLICY "Admins read all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read all order_items" ON public.order_items;
CREATE POLICY "Admins read all order_items" ON public.order_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read all reviews" ON public.reviews;
CREATE POLICY "Admins read all reviews" ON public.reviews
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read all user_roles" ON public.user_roles;
CREATE POLICY "Admins read all user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read all payouts" ON public.payouts;
CREATE POLICY "Admins read all payouts" ON public.payouts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Hide non-approved products from public catalog
DROP POLICY IF EXISTS "Public products are viewable" ON public.products;
DROP POLICY IF EXISTS "products_public_select" ON public.products;
CREATE POLICY "Approved products public read" ON public.products
  FOR SELECT TO anon, authenticated
  USING (is_active = true AND moderation_status = 'approved');

DROP POLICY IF EXISTS "Sellers read own products" ON public.products;
CREATE POLICY "Sellers read own products" ON public.products
  FOR SELECT TO authenticated USING (seller_id = auth.uid());

-- Hide hidden reviews from public
DROP POLICY IF EXISTS "reviews_public_select" ON public.reviews;
DROP POLICY IF EXISTS "Public can read reviews" ON public.reviews;
CREATE POLICY "Visible reviews public read" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (is_hidden = false);

CREATE INDEX IF NOT EXISTS idx_products_moderation ON public.products(moderation_status);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON public.admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_return ON public.order_items(status) WHERE status IN ('return_requested','returned');
