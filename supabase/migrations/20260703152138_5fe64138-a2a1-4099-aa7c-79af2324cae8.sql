
-- Reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL,
  comment TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT reviews_photos_limit CHECK (array_length(photos, 1) IS NULL OR array_length(photos, 1) <= 5),
  CONSTRAINT reviews_unique_per_order_item UNIQUE (order_item_id)
);

CREATE INDEX reviews_product_idx ON public.reviews(product_id);
CREATE INDEX reviews_user_idx ON public.reviews(user_id);

GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public can read all reviews (they are non-anonymous, tied to a purchase)
CREATE POLICY "reviews_public_select" ON public.reviews
  FOR SELECT USING (true);

-- Users can insert their own reviews
CREATE POLICY "reviews_insert_own" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update/delete their own reviews
CREATE POLICY "reviews_update_own" ON public.reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_delete_own" ON public.reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies for review-photos bucket
-- Authenticated users can upload to their own folder ({uid}/...)
CREATE POLICY "review_photos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'review-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "review_photos_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'review-photos');

CREATE POLICY "review_photos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'review-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
