
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE public.payouts
  DROP CONSTRAINT IF EXISTS payouts_method_check;
ALTER TABLE public.payouts
  ADD CONSTRAINT payouts_method_check
  CHECK (method IS NULL OR method IN ('sbp','card','bank'));

ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS default_payout_method text,
  ADD COLUMN IF NOT EXISTS default_payout_destination text;

ALTER TABLE public.seller_profiles
  DROP CONSTRAINT IF EXISTS seller_profiles_default_payout_method_check;
ALTER TABLE public.seller_profiles
  ADD CONSTRAINT seller_profiles_default_payout_method_check
  CHECK (default_payout_method IS NULL OR default_payout_method IN ('sbp','card','bank'));
