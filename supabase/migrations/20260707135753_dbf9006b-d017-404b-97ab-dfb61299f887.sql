
CREATE TABLE public.email_short_link_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  purpose text,
  outcome text NOT NULL,
  user_id uuid,
  user_agent text,
  ip_hint text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_esle_created_at ON public.email_short_link_events (created_at DESC);
CREATE INDEX idx_esle_token ON public.email_short_link_events (token);
CREATE INDEX idx_esle_outcome ON public.email_short_link_events (outcome);

GRANT SELECT ON public.email_short_link_events TO authenticated;
GRANT ALL ON public.email_short_link_events TO service_role;

ALTER TABLE public.email_short_link_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view short link events"
  ON public.email_short_link_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Replace consume RPC with logging + accept client context.
CREATE OR REPLACE FUNCTION public.consume_email_short_link(
  _token text,
  _user_agent text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.email_short_links;
  v_outcome text;
  v_result text := NULL;
BEGIN
  SELECT * INTO v_row FROM public.email_short_links WHERE token = _token;

  IF NOT FOUND THEN
    v_outcome := 'not_found';
  ELSIF v_row.expires_at < now() THEN
    v_outcome := 'expired';
  ELSIF v_row.used_at IS NOT NULL AND v_row.used_at < now() - interval '10 minutes' THEN
    v_outcome := 'used';
  ELSE
    IF v_row.used_at IS NULL THEN
      UPDATE public.email_short_links SET used_at = now() WHERE token = _token;
      v_outcome := 'success';
    ELSE
      v_outcome := 'success_grace';
    END IF;
    v_result := v_row.target_url;
  END IF;

  BEGIN
    INSERT INTO public.email_short_link_events (token, purpose, outcome, user_id, user_agent)
    VALUES (_token, v_row.purpose, v_outcome, auth.uid(), NULLIF(_user_agent, ''));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.consume_email_short_link(text, text) TO anon, authenticated;
