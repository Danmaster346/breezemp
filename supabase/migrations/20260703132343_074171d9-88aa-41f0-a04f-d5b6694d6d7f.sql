
CREATE TABLE public.payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_kopecks INTEGER NOT NULL CHECK (amount_kopecks > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX payouts_seller_created_idx ON public.payouts(seller_id, created_at DESC);
GRANT SELECT, INSERT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers view own payouts" ON public.payouts FOR SELECT TO authenticated USING (auth.uid() = seller_id);
CREATE POLICY "Sellers create own payouts" ON public.payouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
