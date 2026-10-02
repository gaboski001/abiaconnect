CREATE OR REPLACE FUNCTION public.get_active_donation_accounts()
RETURNS TABLE (
  id uuid,
  account_type text,
  account_name text,
  account_number text,
  bank_name text,
  crypto_currency text,
  crypto_network text,
  wallet_address text,
  description text,
  order_index integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.account_type, d.account_name, d.account_number, d.bank_name,
         d.crypto_currency, d.crypto_network, d.wallet_address, d.description, d.order_index
    FROM public.donation_accounts d
   WHERE d.is_active = true
   ORDER BY d.order_index, d.id
   LIMIT 50
$$;
REVOKE EXECUTE ON FUNCTION public.get_active_donation_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_donation_accounts() TO anon, authenticated;