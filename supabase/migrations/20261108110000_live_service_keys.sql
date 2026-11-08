-- Live rooms: the live service's address and keys, set by an admin in
-- Admin -> Live rooms instead of the project secrets.
--
--   - The secret is kept in Vault and never sent back to the app; admins see
--     only a short preview (first and last few characters).
--   - Only the live-room function (service role) can read the full details.
--   - LIVEKIT_* project secrets, when set, still take priority.

CREATE TABLE IF NOT EXISTS public.live_service_config (
  id              boolean PRIMARY KEY DEFAULT true CHECK (id),
  url             text NOT NULL,
  api_key         text NOT NULL,
  secret_vault_id uuid NOT NULL,
  secret_preview  text NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid
);
ALTER TABLE public.live_service_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_service_config FROM PUBLIC, anon, authenticated;

-- Save the address and key, and the secret when given (empty keeps the saved one).
-- Returns what admins may see.
CREATE OR REPLACE FUNCTION public.admin_set_live_service(_url text, _api_key text, _secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := lower(btrim(COALESCE(_url, '')));
  v_key text := btrim(COALESCE(_api_key, ''));
  v_secret text := btrim(COALESCE(_secret, ''));
  v_row public.live_service_config;
  v_vault uuid;
  v_preview text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  -- Accept the address as LiveKit shows it, with or without wss://.
  v_url := regexp_replace(v_url, '^(wss?|https?)://', '');
  v_url := regexp_replace(v_url, '/+$', '');
  IF v_url !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$' OR position('.' IN v_url) = 0 THEN
    RAISE EXCEPTION 'That does not look like the project URL (e.g. abiaconnect-xxxx.livekit.cloud).' USING ERRCODE = '22023';
  END IF;
  v_url := 'wss://' || v_url;
  IF v_key !~ '^[A-Za-z0-9_-]{6,100}$' THEN
    RAISE EXCEPTION 'That does not look like an API key (it usually starts with API).' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.live_service_config FOR UPDATE;
  IF v_secret = '' THEN
    IF NOT FOUND THEN RAISE EXCEPTION 'Paste the API secret too.' USING ERRCODE = '22023'; END IF;
    v_vault := v_row.secret_vault_id;
    v_preview := v_row.secret_preview;
  ELSE
    IF length(v_secret) < 20 OR length(v_secret) > 200 OR v_secret ~ '\s' THEN
      RAISE EXCEPTION 'That does not look like an API secret.' USING ERRCODE = '22023';
    END IF;
    v_preview := left(v_secret, 4) || '…' || right(v_secret, 4);
    IF FOUND THEN
      PERFORM vault.update_secret(v_row.secret_vault_id, v_secret, 'live:secret', 'Live rooms API secret');
      v_vault := v_row.secret_vault_id;
    ELSE
      v_vault := vault.create_secret(v_secret, 'live:secret', 'Live rooms API secret');
    END IF;
  END IF;

  INSERT INTO public.live_service_config (id, url, api_key, secret_vault_id, secret_preview, updated_at, updated_by)
  VALUES (true, v_url, v_key, v_vault, v_preview, now(), auth.uid())
  ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, api_key = EXCLUDED.api_key, secret_vault_id = EXCLUDED.secret_vault_id,
    secret_preview = EXCLUDED.secret_preview, updated_at = now(), updated_by = auth.uid();
  RETURN public.admin_live_service_status();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_live_service_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT jsonb_build_object('url', c.url, 'api_key', c.api_key, 'secret_preview', c.secret_preview, 'updated_at', c.updated_at)
          FROM public.live_service_config c);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_live_service()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.live_service_config;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.live_service_config RETURNING * INTO v_row;
  IF FOUND THEN DELETE FROM vault.secrets WHERE id = v_row.secret_vault_id; END IF;
END;
$$;

-- For the live-room function only.
CREATE OR REPLACE FUNCTION public.get_live_service_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('url', c.url, 'api_key', c.api_key, 'secret', d.decrypted_secret)
  FROM public.live_service_config c JOIN vault.decrypted_secrets d ON d.id = c.secret_vault_id
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_live_service(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_live_service_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_clear_live_service() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_live_service_config() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_live_service(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_live_service_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_live_service() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_service_config() TO service_role;

NOTIFY pgrst, 'reload schema';
