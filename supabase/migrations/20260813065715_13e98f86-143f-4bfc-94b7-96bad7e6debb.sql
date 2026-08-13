-- 1. Настройки платформы (ключ-значение)
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_settings_public_read" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "platform_settings_admin_write" ON public.platform_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.platform_settings (key, value) VALUES
  ('commission_pct', '10'),
  ('min_order_rub', '0'),
  ('return_days', '14'),
  ('maintenance_mode', '0'),
  ('maintenance_message', 'Сайт временно недоступен, идут технические работы. Скоро вернёмся!'),
  ('max_products_per_seller', '500'),
  ('max_photos', '8'),
  ('max_file_mb', '5'),
  ('support_email', 'support@kupiks.ru'),
  ('support_phone', '+7 (900) 000-00-00'),
  ('support_tg', '@kupiks_support');

-- 2. Баннеры главной страницы
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  promo_code text,
  link text,
  bg_color text NOT NULL DEFAULT '#0f172a',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banners TO anon, authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banners_public_read_active" ON public.banners FOR SELECT USING (is_active = true);
CREATE POLICY "banners_admin_read" ON public.banners FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "banners_admin_write" ON public.banners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER banners_updated_at BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX banners_active_sort_idx ON public.banners (is_active, sort_order);

-- 3. История рассылок администратора
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  link text,
  target text NOT NULL DEFAULT 'all',
  type text NOT NULL DEFAULT 'info',
  recipients_count integer NOT NULL DEFAULT 0,
  sent_by uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_notifications_admin_read" ON public.admin_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Персональные уведомления пользователей
CREATE TABLE public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_id uuid REFERENCES public.admin_notifications(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  type text NOT NULL DEFAULT 'info',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_notifications_own_read" ON public.user_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_notifications_own_update" ON public.user_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX user_notifications_user_idx ON public.user_notifications (user_id, created_at DESC);

-- 5. Заморозка баланса продавца
ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS balance_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS freeze_reason text,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz;