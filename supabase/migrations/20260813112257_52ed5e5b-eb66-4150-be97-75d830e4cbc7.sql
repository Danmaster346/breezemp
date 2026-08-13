-- Seller cabinet performance indexes (idempotent; existing tables/indexes untouched)

-- Orders: dashboard/analytics sorting by date
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- Order items: seller cabinet lists filtered by seller + status, sorted by order
CREATE INDEX IF NOT EXISTS idx_order_items_seller_status ON public.order_items (seller_id, status);

-- Reviews: product page shows only visible reviews, newest first
CREATE INDEX IF NOT EXISTS idx_reviews_product_visible ON public.reviews (product_id, created_at DESC) WHERE is_hidden = false;

-- Warehouse: supplies history per seller
CREATE INDEX IF NOT EXISTS idx_supplies_seller_date ON public.supplies (seller_id, supplied_at DESC);
CREATE INDEX IF NOT EXISTS idx_supply_items_product ON public.supply_items (product_id);

-- Warehouse: stock movements per product
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements (product_id, created_at DESC);

-- Products: low-stock widget per seller
CREATE INDEX IF NOT EXISTS idx_products_seller_stock ON public.products (seller_id, stock);
