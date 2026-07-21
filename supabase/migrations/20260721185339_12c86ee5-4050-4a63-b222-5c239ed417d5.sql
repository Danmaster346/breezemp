
CREATE TABLE public.review_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_rating smallint NOT NULL,
  new_rating smallint NOT NULL,
  old_comment text,
  new_comment text,
  old_photos text[] NOT NULL DEFAULT '{}',
  new_photos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX review_edits_review_idx ON public.review_edits(review_id);
CREATE INDEX review_edits_user_idx ON public.review_edits(user_id);

GRANT SELECT ON public.review_edits TO authenticated;
GRANT ALL ON public.review_edits TO service_role;

ALTER TABLE public.review_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_edits_select_own"
  ON public.review_edits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "review_edits_admin_select"
  ON public.review_edits FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
