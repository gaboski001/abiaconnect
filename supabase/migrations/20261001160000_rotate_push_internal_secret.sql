-- Rotate the internal token used by the push triggers to call send-push.
--
-- The previous value was committed in plain text to an older migration, so
-- anyone with repository access could call send-push and push arbitrary
-- notifications to any user. The new value is generated inside the database
-- and never appears in source control.
--
-- send-push now validates the token against Vault via
-- get_push_internal_secret() (service role only) instead of an environment
-- variable, so the old leaked value stops working as soon as this runs and
-- future rotations need no manual steps.

CREATE OR REPLACE FUNCTION public.get_push_internal_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_internal_secret' LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_push_internal_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_internal_secret() TO service_role;

-- Re-runnable: each run generates a fresh random 256-bit token.
DO $$
DECLARE
  v_secret text;
  v_id uuid;
BEGIN
  BEGIN
    v_secret := encode(extensions.gen_random_bytes(32), 'hex');
  EXCEPTION WHEN undefined_function OR invalid_schema_name THEN
    v_secret := encode(gen_random_bytes(32), 'hex');
  END;

  SELECT id INTO v_id FROM vault.secrets WHERE name = 'push_internal_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(v_secret, 'push_internal_secret', 'Internal token for database to send-push calls');
  ELSE
    PERFORM vault.update_secret(v_id, v_secret);
  END IF;
END
$$;
