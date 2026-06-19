DROP POLICY IF EXISTS "Public can view active donation accounts" ON public.donation_accounts;
CREATE POLICY "Authenticated can view active donation accounts"
  ON public.donation_accounts
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin(auth.uid()));
REVOKE SELECT ON public.donation_accounts FROM anon;