
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';

INSERT INTO public.categories (name, slug, icon)
SELECT v.name, v.slug, v.icon FROM (VALUES
  ('Обувь','obuv','👟'),
  ('Другое','other','📦')
) AS v(name, slug, icon)
WHERE NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.slug = v.slug);

CREATE POLICY "product_images_read_all"
ON storage.objects FOR SELECT TO authenticated, anon
USING (bucket_id = 'product-images');

CREATE POLICY "product_images_seller_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "product_images_seller_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "product_images_seller_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
