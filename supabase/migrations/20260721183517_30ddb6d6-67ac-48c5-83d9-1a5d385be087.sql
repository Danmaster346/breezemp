
CREATE TABLE public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  comment text,
  status text NOT NULL DEFAULT 'pending',
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_reports_reason_check CHECK (reason IN ('spam','offensive','fake','off_topic','personal_info','other')),
  CONSTRAINT review_reports_status_check CHECK (status IN ('pending','resolved_hidden','resolved_kept','dismissed')),
  CONSTRAINT review_reports_unique_reporter UNIQUE (review_id, reporter_id)
);

CREATE INDEX review_reports_status_idx ON public.review_reports (status, created_at DESC);
CREATE INDEX review_reports_review_idx ON public.review_reports (review_id);

GRANT SELECT, INSERT ON public.review_reports TO authenticated;
GRANT ALL ON public.review_reports TO service_role;

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_reports_insert_own"
  ON public.review_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "review_reports_select_own"
  ON public.review_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "review_reports_admin_all_select"
  ON public.review_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "review_reports_admin_update"
  ON public.review_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "review_reports_admin_delete"
  ON public.review_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_review_reports_updated_at
  BEFORE UPDATE ON public.review_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
