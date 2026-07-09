
CREATE TABLE public.seller_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name text,
  logo_path text,
  short_description text,
  full_description text,
  phone text,
  email text,
  whatsapp text,
  telegram text,
  instagram text,
  vk text,
  other_social text,
  badges text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.seller_profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_profiles TO authenticated;
GRANT ALL ON public.seller_profiles TO service_role;

ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sp_select_all" ON public.seller_profiles FOR SELECT USING (true);
CREATE POLICY "sp_insert_own" ON public.seller_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sp_update_own" ON public.seller_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sp_delete_own" ON public.seller_profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER sp_updated_at BEFORE UPDATE ON public.seller_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for store-logos (private bucket, but SELECT open so logos display anywhere)
CREATE POLICY "store_logos_select_all" ON storage.objects FOR SELECT
USING (bucket_id = 'store-logos');

CREATE POLICY "store_logos_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'store-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "store_logos_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'store-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "store_logos_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'store-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
