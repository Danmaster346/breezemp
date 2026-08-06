ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_mode text NOT NULL DEFAULT 'buyer';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_mode_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_mode_check
  CHECK (preferred_mode IN ('buyer', 'seller'));