
CREATE TABLE public.review_abuse_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason_code text NOT NULL,
  message text,
  product_id uuid,
  order_item_id uuid,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.review_abuse_logs TO authenticated;
GRANT ALL ON public.review_abuse_logs TO service_role;

ALTER TABLE public.review_abuse_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view review abuse logs"
  ON public.review_abuse_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_review_abuse_logs_user ON public.review_abuse_logs (user_id, created_at DESC);
CREATE INDEX idx_review_abuse_logs_reason ON public.review_abuse_logs (reason_code, created_at DESC);
CREATE INDEX idx_review_abuse_logs_created ON public.review_abuse_logs (created_at DESC);
