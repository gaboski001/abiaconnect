
CREATE TABLE public.password_reset_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL CHECK (event IN ('verified','invalid','updated','resent','resend_failed')),
  email_hash text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.password_reset_audit TO authenticated;
GRANT ALL ON public.password_reset_audit TO service_role;

ALTER TABLE public.password_reset_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reset audit"
  ON public.password_reset_audit
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_password_reset_audit_created_at ON public.password_reset_audit (created_at DESC);
CREATE INDEX idx_password_reset_audit_event ON public.password_reset_audit (event);
