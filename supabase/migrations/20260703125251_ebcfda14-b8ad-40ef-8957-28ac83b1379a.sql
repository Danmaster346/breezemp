
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_status_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_status_check
  CHECK (status IN ('new','confirmed','processing','shipped','delivered','cancelled'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
