ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS seller_reply text,
  ADD COLUMN IF NOT EXISTS seller_reply_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.favorites_sellers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, seller_id)
);

GRANT SELECT, INSERT, DELETE ON public.favorites_sellers TO authenticated;
GRANT ALL ON public.favorites_sellers TO service_role;

ALTER TABLE public.favorites_sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own seller subscriptions"
  ON public.favorites_sellers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users subscribe themselves"
  ON public.favorites_sellers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users unsubscribe themselves"
  ON public.favorites_sellers FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS favorites_sellers_seller_idx ON public.favorites_sellers (seller_id);