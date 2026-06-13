
CREATE TABLE public.donation_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type text NOT NULL CHECK (account_type IN ('bank','crypto','mobile_money')),
  account_name text NOT NULL,
  account_number text,
  bank_name text,
  crypto_currency text,
  crypto_network text,
  wallet_address text,
  description text,
  is_active boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.donation_accounts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.donation_accounts TO authenticated;
GRANT ALL ON public.donation_accounts TO service_role;

ALTER TABLE public.donation_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active donation accounts"
ON public.donation_accounts FOR SELECT
USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert donation accounts"
ON public.donation_accounts FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update donation accounts"
ON public.donation_accounts FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete donation accounts"
ON public.donation_accounts FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_donation_accounts_updated_at
BEFORE UPDATE ON public.donation_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_donation_accounts_active_order
ON public.donation_accounts (is_active, order_index);

ALTER PUBLICATION supabase_realtime ADD TABLE public.donation_accounts;
ALTER TABLE public.donation_accounts REPLICA IDENTITY FULL;
