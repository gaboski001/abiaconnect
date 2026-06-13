
-- Donations table
CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name text NOT NULL,
  donor_email text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'NGN',
  message text,
  is_anonymous boolean NOT NULL DEFAULT false,
  payment_method text NOT NULL DEFAULT 'bank_transfer',
  reference text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  admin_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX donations_status_created_idx ON public.donations (status, created_at DESC);
CREATE INDEX donations_created_at_idx ON public.donations (created_at DESC);

GRANT SELECT, INSERT ON public.donations TO anon, authenticated;
GRANT UPDATE, DELETE ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a donation, but it must start as pending and not pre-confirmed.
CREATE POLICY "Anyone can submit a donation"
  ON public.donations FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending' AND confirmed_by IS NULL AND confirmed_at IS NULL);

-- Only admins can read full rows (with emails, notes, etc.)
CREATE POLICY "Admins read all donations"
  ON public.donations FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins update donations"
  ON public.donations FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete donations"
  ON public.donations FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER donations_updated_at
  BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public helper: recent confirmed donations (email hidden, anonymous masked)
CREATE OR REPLACE FUNCTION public.get_public_donations(_limit int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  donor_name text,
  amount numeric,
  currency text,
  message text,
  is_anonymous boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    CASE WHEN d.is_anonymous THEN 'Anonymous' ELSE d.donor_name END,
    d.amount,
    d.currency,
    d.message,
    d.is_anonymous,
    d.created_at
  FROM public.donations d
  WHERE d.status = 'confirmed'
  ORDER BY d.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
$$;

GRANT EXECUTE ON FUNCTION public.get_public_donations(int) TO anon, authenticated;

-- Public helper: aggregate totals per currency for confirmed donations
CREATE OR REPLACE FUNCTION public.get_donation_totals()
RETURNS TABLE (
  currency text,
  total numeric,
  donor_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT currency, COALESCE(SUM(amount), 0)::numeric, COUNT(*)::bigint
  FROM public.donations
  WHERE status = 'confirmed'
  GROUP BY currency;
$$;

GRANT EXECUTE ON FUNCTION public.get_donation_totals() TO anon, authenticated;

-- Seed default donation settings (idempotent)
INSERT INTO public.site_settings (key, value) VALUES
  ('donation_goal', '"2000000"'::jsonb),
  ('donation_currency', '"NGN"'::jsonb),
  ('donation_intro', '"AbiaConnect is a non-profit, community-driven platform. Every contribution helps keep our servers running and our community growing — globally."'::jsonb),
  ('donation_bank_details', '"Bank: [Your Bank]\nAccount Name: AbiaConnect\nAccount Number: 0000000000\n\nUse your full name as the transfer reference, then submit the form below so we can confirm your donation."'::jsonb),
  ('donation_suggested_amounts', '"1000,5000,10000,25000,50000"'::jsonb),
  ('donation_enabled', '"true"'::jsonb)
ON CONFLICT (key) DO NOTHING;
