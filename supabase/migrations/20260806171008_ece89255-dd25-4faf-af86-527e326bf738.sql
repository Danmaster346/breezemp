CREATE TABLE public.product_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('view','add_to_cart')),
  visitor_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_events TO authenticated;
GRANT ALL ON public.product_events TO service_role;

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers read own product events" ON public.product_events
  FOR SELECT TO authenticated USING (auth.uid() = seller_id);

CREATE POLICY "Admins read all product events" ON public.product_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX product_events_seller_created_idx ON public.product_events (seller_id, created_at DESC);
CREATE INDEX product_events_product_created_idx ON public.product_events (product_id, created_at DESC);
CREATE INDEX product_events_kind_idx ON public.product_events (kind);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS compare_at_price_kopecks integer,
  ADD COLUMN IF NOT EXISTS badges text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS discount_notified_at timestamp with time zone;

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS promo_codes_seller_idx ON public.promo_codes (seller_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;

CREATE POLICY "Sellers manage own promo codes" ON public.promo_codes
  FOR ALL TO authenticated
  USING (seller_id IS NOT NULL AND auth.uid() = seller_id)
  WITH CHECK (seller_id IS NOT NULL AND auth.uid() = seller_id);

CREATE POLICY "Admins manage promo codes" ON public.promo_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));