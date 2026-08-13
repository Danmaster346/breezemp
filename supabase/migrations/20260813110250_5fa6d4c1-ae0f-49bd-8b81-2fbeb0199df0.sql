CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Быстрые выборки каталога
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_seller ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_price ON public.products(price_kopecks);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_active_visible ON public.products(is_active, moderation_status, created_at DESC);

-- Полнотекстовый и частичный поиск
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('russian', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_products_search_tsv ON public.products USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON public.products USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON public.products USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON public.profiles USING GIN (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_shop_name_trgm ON public.seller_profiles USING GIN (shop_name gin_trgm_ops);

-- Заказы и позиции
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON public.order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON public.order_items(status);

-- Отзывы, избранное, события, сообщения
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_product_events_seller ON public.product_events(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_product ON public.product_events(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON public.chat_messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_seller ON public.stock_movements(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_seller ON public.payouts(seller_id, created_at DESC);