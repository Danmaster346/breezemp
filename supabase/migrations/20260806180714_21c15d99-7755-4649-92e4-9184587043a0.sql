-- Индексы для быстрой работы каталога
CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products (category_id);
CREATE INDEX IF NOT EXISTS products_price_kopecks_idx ON public.products (price_kopecks);
CREATE INDEX IF NOT EXISTS products_created_at_idx ON public.products (created_at DESC);
CREATE INDEX IF NOT EXISTS products_seller_id_idx ON public.products (seller_id);
CREATE INDEX IF NOT EXISTS products_active_moderation_idx
  ON public.products (is_active, moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_product_id_idx ON public.reviews (product_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON public.order_items (product_id);