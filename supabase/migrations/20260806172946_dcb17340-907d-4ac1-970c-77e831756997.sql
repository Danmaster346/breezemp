CREATE TABLE public.order_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_osh_order ON public.order_status_history (order_id, created_at);
CREATE INDEX idx_osh_item ON public.order_status_history (order_item_id, created_at);

GRANT SELECT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer can view own order history"
ON public.order_status_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND o.buyer_id = auth.uid()));

CREATE POLICY "Seller can view own item history"
ON public.order_status_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.id = order_status_history.order_item_id AND oi.seller_id = auth.uid()));

CREATE POLICY "Admins can view all history"
ON public.order_status_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_order_item_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history (order_id, order_item_id, old_status, new_status)
    VALUES (NEW.order_id, NEW.id, NULL, NEW.status);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (order_id, order_item_id, old_status, new_status)
    VALUES (NEW.order_id, NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_items_status_history
AFTER INSERT OR UPDATE OF status ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.log_order_item_status();