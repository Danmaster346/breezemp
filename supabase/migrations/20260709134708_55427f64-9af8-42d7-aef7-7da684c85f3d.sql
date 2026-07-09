
CREATE OR REPLACE FUNCTION public.decrement_product_stock(_product_id uuid, _qty integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r integer;
BEGIN
  IF _qty <= 0 THEN RETURN false; END IF;
  UPDATE public.products SET stock = stock - _qty
   WHERE id = _product_id AND stock >= _qty AND is_active = true;
  GET DIAGNOSTICS r = ROW_COUNT;
  RETURN r > 0;
END; $$;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.decrement_product_stock(uuid, integer) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.consume_promo_code(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r integer;
BEGIN
  UPDATE public.promo_codes SET used_count = used_count + 1
   WHERE upper(code) = upper(_code)
     AND active = true
     AND (expires_at IS NULL OR expires_at > now())
     AND (max_uses IS NULL OR used_count < max_uses);
  GET DIAGNOSTICS r = ROW_COUNT;
  RETURN r > 0;
END; $$;
GRANT EXECUTE ON FUNCTION public.consume_promo_code(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.consume_promo_code(text) FROM anon, authenticated, public;

ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payouts_status_check') THEN
    ALTER TABLE public.payouts ADD CONSTRAINT payouts_status_check CHECK (status IN ('pending','completed','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id) WHERE is_hidden = false;
CREATE INDEX IF NOT EXISTS idx_chats_buyer ON public.chats(buyer_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_seller ON public.chats(seller_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created ON public.chat_messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON public.chat_messages(chat_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_status ON public.order_items(status);
CREATE INDEX IF NOT EXISTS idx_products_moderation ON public.products(moderation_status) WHERE is_active = true;

DROP POLICY IF EXISTS sp_select_all ON public.seller_profiles;
DROP POLICY IF EXISTS sp_select_public ON public.seller_profiles;
DROP POLICY IF EXISTS sp_select_auth ON public.seller_profiles;
DROP POLICY IF EXISTS sp_select_anon ON public.seller_profiles;
CREATE POLICY sp_select_public ON public.seller_profiles FOR SELECT USING (true);

REVOKE ALL ON public.seller_profiles FROM anon;
REVOKE ALL ON public.seller_profiles FROM authenticated;
GRANT SELECT (user_id, shop_name, short_description, full_description, logo_path, badges, created_at, updated_at)
  ON public.seller_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.seller_profiles TO authenticated;
GRANT ALL ON public.seller_profiles TO service_role;
