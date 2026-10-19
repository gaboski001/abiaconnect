-- AI provider: let the site owner run AbiaConnect's AI (the Newsdesk and Ugo
-- moderation) on their own Claude, Gemini or DeepSeek account instead of
-- Lovable AI credit, with Lovable AI as an optional backup.
--
-- * API keys are stored encrypted in Supabase Vault, like the payment keys.
--   Admins can set, replace or remove a key but never read it back; the
--   dashboard only sees a masked preview.
-- * Only the service role (the edge functions) can decrypt them.
-- * Each AI call is counted (feature, provider, success), never its content,
--   so the admin can see how much still depends on Lovable AI.

-- ---- Keys ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_provider_keys (
  provider   text PRIMARY KEY CHECK (provider IN ('claude', 'gemini', 'deepseek')),
  preview    text NOT NULL,
  vault_id   uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
REVOKE ALL ON public.ai_provider_keys FROM anon, authenticated;
GRANT SELECT ON public.ai_provider_keys TO authenticated;
GRANT ALL ON public.ai_provider_keys TO service_role;
ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read AI key previews" ON public.ai_provider_keys;
CREATE POLICY "Admins read AI key previews" ON public.ai_provider_keys
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ---- The choice -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_provider_settings (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  provider   text NOT NULL DEFAULT 'lovable' CHECK (provider IN ('lovable', 'claude', 'gemini', 'deepseek')),
  -- The model to use for each provider, e.g. {"claude": "claude-haiku-5-5"}.
  models     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Use Lovable AI when the chosen provider fails.
  fallback   boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.ai_provider_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.ai_provider_settings FROM anon, authenticated;
GRANT SELECT ON public.ai_provider_settings TO authenticated;
GRANT ALL ON public.ai_provider_settings TO service_role;
ALTER TABLE public.ai_provider_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read AI settings" ON public.ai_provider_settings;
CREATE POLICY "Admins read AI settings" ON public.ai_provider_settings
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ---- Usage counts -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id         bigserial PRIMARY KEY,
  feature    text NOT NULL,
  provider   text NOT NULL,
  ok         boolean NOT NULL,
  fell_back  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_log_recent ON public.ai_usage_log (created_at DESC);
REVOKE ALL ON public.ai_usage_log FROM anon, authenticated;
GRANT SELECT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ai_usage_log_id_seq TO service_role;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read AI usage" ON public.ai_usage_log;
CREATE POLICY "Admins read AI usage" ON public.ai_usage_log
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- ---- Admin actions ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_ai_key(_provider text, _value text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_value text := btrim(COALESCE(_value, ''));
  v_existing public.ai_provider_keys;
  v_vault_id uuid;
  v_preview text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF _provider NOT IN ('claude', 'gemini', 'deepseek') THEN
    RAISE EXCEPTION 'Unknown AI provider' USING ERRCODE = '22023';
  END IF;
  IF length(v_value) < 20 OR length(v_value) > 500 OR v_value ~ '\s' THEN
    RAISE EXCEPTION 'That does not look like a valid API key' USING ERRCODE = '22023';
  END IF;
  v_preview := left(v_value, 6) || '…' || right(v_value, 4);

  SELECT * INTO v_existing FROM public.ai_provider_keys WHERE provider = _provider FOR UPDATE;
  IF FOUND THEN
    PERFORM vault.update_secret(v_existing.vault_id, v_value, 'ai:' || _provider, 'AI provider API key');
    v_vault_id := v_existing.vault_id;
  ELSE
    v_vault_id := vault.create_secret(v_value, 'ai:' || _provider, 'AI provider API key');
  END IF;

  INSERT INTO public.ai_provider_keys (provider, preview, vault_id, updated_at, updated_by)
  VALUES (_provider, v_preview, v_vault_id, now(), auth.uid())
  ON CONFLICT (provider) DO UPDATE
    SET preview = EXCLUDED.preview, vault_id = EXCLUDED.vault_id, updated_at = now(), updated_by = auth.uid();
  RETURN v_preview;
END $$;

CREATE OR REPLACE FUNCTION public.admin_clear_ai_key(_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.ai_provider_keys;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.ai_provider_keys WHERE provider = _provider RETURNING * INTO v_row;
  IF NOT FOUND THEN RETURN; END IF;
  DELETE FROM vault.secrets WHERE id = v_row.vault_id;
  -- A provider can't be used without its key: go back to Lovable AI.
  UPDATE public.ai_provider_settings SET provider = 'lovable', updated_at = now(), updated_by = auth.uid()
   WHERE provider = _provider;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_ai_settings(_provider text, _models jsonb, _fallback boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  IF _provider NOT IN ('lovable', 'claude', 'gemini', 'deepseek') THEN
    RAISE EXCEPTION 'Unknown AI provider' USING ERRCODE = '22023';
  END IF;
  IF _provider <> 'lovable' AND NOT EXISTS (SELECT 1 FROM public.ai_provider_keys WHERE provider = _provider) THEN
    RAISE EXCEPTION 'Save the % API key first.', initcap(_provider) USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.ai_provider_settings (id, provider, models, fallback, updated_at, updated_by)
  VALUES (true, _provider, COALESCE(_models, '{}'::jsonb), COALESCE(_fallback, true), now(), auth.uid())
  ON CONFLICT (id) DO UPDATE
    SET provider = EXCLUDED.provider, models = EXCLUDED.models, fallback = EXCLUDED.fallback,
        updated_at = now(), updated_by = auth.uid();
END $$;

-- AI calls per feature and provider over the last few days, for the dashboard.
CREATE OR REPLACE FUNCTION public.admin_ai_usage(_days integer DEFAULT 7)
RETURNS TABLE (feature text, provider text, calls bigint, failed bigint, fell_back bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT l.feature, l.provider, count(*), count(*) FILTER (WHERE NOT l.ok), count(*) FILTER (WHERE l.fell_back)
      FROM public.ai_usage_log l
     WHERE l.created_at > now() - make_interval(days => GREATEST(1, LEAST(_days, 90)))
     GROUP BY l.feature, l.provider
     ORDER BY count(*) DESC;
END $$;

-- ---- For the edge functions (service role only) ----------------------------------------
CREATE OR REPLACE FUNCTION public.get_ai_config()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'provider', COALESCE(s.provider, 'lovable'),
    'models', COALESCE(s.models, '{}'::jsonb),
    'fallback', COALESCE(s.fallback, true),
    'keys', COALESCE((
      SELECT jsonb_object_agg(k.provider, d.decrypted_secret)
        FROM public.ai_provider_keys k
        JOIN vault.decrypted_secrets d ON d.id = k.vault_id
    ), '{}'::jsonb)
  )
  FROM (SELECT true AS one) x
  LEFT JOIN public.ai_provider_settings s ON s.id
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_ai_key(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_clear_ai_key(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_ai_settings(text, jsonb, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_ai_usage(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ai_config() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ai_key(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_ai_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ai_settings(text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ai_usage(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_config() TO service_role;

-- Keep 60 days of counts.
DO $$ BEGIN
  PERFORM cron.unschedule('ai-usage-cleanup');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('ai-usage-cleanup', '30 3 * * 0',
  $$DELETE FROM public.ai_usage_log WHERE created_at < now() - interval '60 days'$$);
