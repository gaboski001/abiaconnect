
CREATE TABLE IF NOT EXISTS public.email_short_links (
  token text PRIMARY KEY,
  target_url text NOT NULL,
  purpose text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_short_links TO service_role;
GRANT ALL ON public.email_short_links TO service_role;

ALTER TABLE public.email_short_links ENABLE ROW LEVEL SECURITY;

-- No client policies: table is only touched via SECURITY DEFINER RPCs below.

CREATE OR REPLACE FUNCTION public.create_email_short_link(
  _target_url text,
  _purpose text DEFAULT NULL,
  _ttl_seconds integer DEFAULT 86400
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  -- URL-safe base64-ish token, ~22 chars
  v_token := replace(replace(replace(encode(gen_random_bytes(16), 'base64'), '+', '-'), '/', '_'), '=', '');
  INSERT INTO public.email_short_links (token, target_url, purpose, expires_at)
  VALUES (v_token, _target_url, _purpose, now() + make_interval(secs => GREATEST(60, _ttl_seconds)));
  RETURN v_token;
END;
$$;

-- Only edge functions running as service_role should mint short links.
REVOKE ALL ON FUNCTION public.create_email_short_link(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_email_short_link(text, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_email_short_link(_token text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.email_short_links;
BEGIN
  SELECT * INTO v_row FROM public.email_short_links WHERE token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_row.expires_at < now() THEN RETURN NULL; END IF;
  -- Single-use: mark used the first time, but keep returning the URL for a short window
  -- so email clients that prefetch links don't invalidate the user's tap. 10 min grace.
  IF v_row.used_at IS NULL THEN
    UPDATE public.email_short_links SET used_at = now() WHERE token = _token;
  ELSIF v_row.used_at < now() - interval '10 minutes' THEN
    RETURN NULL;
  END IF;
  RETURN v_row.target_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_email_short_link(text) TO anon, authenticated;

-- Housekeeping: prune long-expired links
CREATE OR REPLACE FUNCTION public.prune_email_short_links()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.email_short_links WHERE expires_at < now() - interval '7 days';
$$;
