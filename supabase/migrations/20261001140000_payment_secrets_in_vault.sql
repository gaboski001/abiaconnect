-- Payment provider API keys managed from the admin dashboard.
--
-- * Values are stored encrypted in Supabase Vault (vault.secrets).
-- * Admins can set, replace or remove a key, but can never read it back;
--   the dashboard only sees a masked preview such as "sk_test_xxxxxxxxxx".
-- * Only the service role (payment edge functions) can decrypt them.
-- * Every change is written to the monetization audit log (without values).

CREATE TABLE IF NOT EXISTS public.payment_secret_settings (
  name       text PRIMARY KEY CHECK (name IN (
               'PAYSTACK_TEST_SECRET_KEY', 'PAYSTACK_LIVE_SECRET_KEY',
               'MONNIFY_TEST_API_KEY', 'MONNIFY_TEST_SECRET_KEY',
               'MONNIFY_LIVE_API_KEY', 'MONNIFY_LIVE_SECRET_KEY',
               'SQUAD_TEST_SECRET_KEY', 'SQUAD_LIVE_SECRET_KEY')),
  provider   text NOT NULL CHECK (provider IN ('paystack', 'monnify', 'squad')),
  mode       text NOT NULL CHECK (mode IN ('test', 'live')),
  preview    text NOT NULL,
  vault_id   uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.payment_secret_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read payment secret previews" ON public.payment_secret_settings;
CREATE POLICY "Admins read payment secret previews"
  ON public.payment_secret_settings FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON public.payment_secret_settings FROM anon, authenticated;

-- Keep the leading characters that identify the key type (e.g. "sk_test_",
-- "MK_TEST_", "sandbox_sk_") and mask the rest.
CREATE OR REPLACE FUNCTION public.mask_payment_secret(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT left(_value, LEAST(8, GREATEST(3, length(_value) / 4))) || 'xxxxxxxxxx'
$$;

CREATE OR REPLACE FUNCTION public.admin_set_payment_secret(_name text, _value text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value text := btrim(COALESCE(_value, ''));
  v_provider text;
  v_mode text;
  v_existing public.payment_secret_settings;
  v_vault_id uuid;
  v_preview text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF _name NOT IN ('PAYSTACK_TEST_SECRET_KEY', 'PAYSTACK_LIVE_SECRET_KEY',
                   'MONNIFY_TEST_API_KEY', 'MONNIFY_TEST_SECRET_KEY',
                   'MONNIFY_LIVE_API_KEY', 'MONNIFY_LIVE_SECRET_KEY',
                   'SQUAD_TEST_SECRET_KEY', 'SQUAD_LIVE_SECRET_KEY') THEN
    RAISE EXCEPTION 'Unknown key name' USING ERRCODE = '22023';
  END IF;
  IF length(v_value) < 10 OR length(v_value) > 500 OR v_value ~ '\s' THEN
    RAISE EXCEPTION 'That does not look like a valid API key' USING ERRCODE = '22023';
  END IF;

  v_provider := lower(split_part(_name, '_', 1));
  v_mode := lower(split_part(_name, '_', 2));
  v_preview := public.mask_payment_secret(v_value);

  SELECT * INTO v_existing FROM public.payment_secret_settings WHERE name = _name FOR UPDATE;
  IF FOUND THEN
    PERFORM vault.update_secret(v_existing.vault_id, v_value, 'payment:' || _name, 'Payment provider API key');
    v_vault_id := v_existing.vault_id;
  ELSE
    v_vault_id := vault.create_secret(v_value, 'payment:' || _name, 'Payment provider API key');
  END IF;

  INSERT INTO public.payment_secret_settings (name, provider, mode, preview, vault_id, updated_at, updated_by)
  VALUES (_name, v_provider, v_mode, v_preview, v_vault_id, now(), auth.uid())
  ON CONFLICT (name) DO UPDATE
    SET preview = EXCLUDED.preview, vault_id = EXCLUDED.vault_id, updated_at = now(), updated_by = auth.uid();

  INSERT INTO public.monetization_audit_log (actor_id, action, target, new_value)
  VALUES (auth.uid(), CASE WHEN v_existing.name IS NULL THEN 'payment_secret.set' ELSE 'payment_secret.replace' END,
          _name, jsonb_build_object('preview', v_preview));
  RETURN v_preview;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_payment_secret(_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.payment_secret_settings;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.payment_secret_settings WHERE name = _name RETURNING * INTO v_row;
  IF NOT FOUND THEN RETURN; END IF;
  DELETE FROM vault.secrets WHERE id = v_row.vault_id;
  -- A provider can't run in a mode whose key was removed: switch it off.
  UPDATE public.payment_providers SET is_enabled = false
   WHERE provider = v_row.provider AND mode = v_row.mode AND is_enabled;
  INSERT INTO public.monetization_audit_log (actor_id, action, target)
  VALUES (auth.uid(), 'payment_secret.remove', _name);
END;
$$;

-- Decrypted keys for the payment edge functions (service role only).
CREATE OR REPLACE FUNCTION public.get_payment_secrets()
RETURNS TABLE (name text, value text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.name, d.decrypted_secret
  FROM public.payment_secret_settings s
  JOIN vault.decrypted_secrets d ON d.id = s.vault_id
$$;

REVOKE EXECUTE ON FUNCTION public.mask_payment_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_payment_secret(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_clear_payment_secret(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_payment_secrets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_secret(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_payment_secret(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_secrets() TO service_role;
GRANT EXECUTE ON FUNCTION public.mask_payment_secret(text) TO service_role;
