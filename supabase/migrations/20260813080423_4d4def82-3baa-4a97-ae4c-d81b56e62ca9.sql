ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock integer NOT NULL DEFAULT 5;

ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;
ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS low_stock_channel text NOT NULL DEFAULT 'app';

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'manual',
  delta integer NOT NULL,
  stock_before integer NOT NULL,
  stock_after integer NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements_select_own" ON public.stock_movements
  FOR SELECT TO authenticated USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS stock_movements_seller_created_idx ON public.stock_movements (seller_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplied_at date NOT NULL DEFAULT current_date,
  comment text,
  total_qty integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supplies TO authenticated;
GRANT ALL ON public.supplies TO service_role;
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supplies_select_own" ON public.supplies
  FOR SELECT TO authenticated USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.supply_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id uuid NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  title_snapshot text NOT NULL DEFAULT '',
  quantity integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.supply_items TO authenticated;
GRANT ALL ON public.supply_items TO service_role;
ALTER TABLE public.supply_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supply_items_select_own" ON public.supply_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.supplies s WHERE s.id = supply_id AND (s.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
CREATE INDEX IF NOT EXISTS supply_items_supply_idx ON public.supply_items (supply_id);