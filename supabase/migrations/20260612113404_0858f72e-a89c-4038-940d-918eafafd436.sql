
-- 5c: Add rules column to subgroups
ALTER TABLE public.subgroups
  ADD COLUMN IF NOT EXISTS rules text[] NOT NULL DEFAULT '{}';

-- 5d: Join requests table
CREATE TABLE IF NOT EXISTS public.subgroup_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subgroup_id uuid NOT NULL REFERENCES public.subgroups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (subgroup_id, user_id, status)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subgroup_join_requests TO authenticated;
GRANT ALL ON public.subgroup_join_requests TO service_role;
ALTER TABLE public.subgroup_join_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sgr_subgroup ON public.subgroup_join_requests(subgroup_id, status);
CREATE INDEX IF NOT EXISTS idx_sgr_user ON public.subgroup_join_requests(user_id);

CREATE POLICY "User views own join requests" ON public.subgroup_join_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_subgroup_admin(subgroup_id, auth.uid()));

CREATE POLICY "User creates own join request" ON public.subgroup_join_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admin updates join request" ON public.subgroup_join_requests
  FOR UPDATE TO authenticated
  USING (public.is_subgroup_admin(subgroup_id, auth.uid()));

CREATE POLICY "User or admin deletes" ON public.subgroup_join_requests
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_subgroup_admin(subgroup_id, auth.uid()));

-- 5d: Invites table
CREATE TABLE IF NOT EXISTS public.subgroup_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subgroup_id uuid NOT NULL REFERENCES public.subgroups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at timestamptz,
  used boolean NOT NULL DEFAULT false,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  single_use boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subgroup_invites TO authenticated;
GRANT ALL ON public.subgroup_invites TO service_role;
ALTER TABLE public.subgroup_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sgi_subgroup ON public.subgroup_invites(subgroup_id);
CREATE INDEX IF NOT EXISTS idx_sgi_token ON public.subgroup_invites(token);

CREATE POLICY "Admin views invites" ON public.subgroup_invites
  FOR SELECT TO authenticated
  USING (public.is_subgroup_admin(subgroup_id, auth.uid()));

CREATE POLICY "Admin creates invites" ON public.subgroup_invites
  FOR INSERT TO authenticated
  WITH CHECK (public.is_subgroup_admin(subgroup_id, auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Admin deletes invites" ON public.subgroup_invites
  FOR DELETE TO authenticated
  USING (public.is_subgroup_admin(subgroup_id, auth.uid()));

-- RPC: redeem invite token (auto-join)
CREATE OR REPLACE FUNCTION public.redeem_subgroup_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.subgroup_invites;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM public.subgroup_invites WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invite'; END IF;
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite expired';
  END IF;
  IF v_invite.single_use AND v_invite.used THEN
    RAISE EXCEPTION 'Invite already used';
  END IF;

  INSERT INTO public.subgroup_members (subgroup_id, user_id)
  VALUES (v_invite.subgroup_id, v_uid)
  ON CONFLICT (subgroup_id, user_id) DO NOTHING;

  IF v_invite.single_use THEN
    UPDATE public.subgroup_invites
      SET used = true, used_by = v_uid, used_at = now()
      WHERE id = v_invite.id;
  END IF;

  RETURN v_invite.subgroup_id;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_subgroup_invite(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_subgroup_invite(text) TO authenticated;

-- RPC: approve/reject join requests
CREATE OR REPLACE FUNCTION public.decide_join_request(_request_id uuid, _approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.subgroup_join_requests;
BEGIN
  SELECT * INTO v_req FROM public.subgroup_join_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT public.is_subgroup_admin(v_req.subgroup_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.subgroup_join_requests
    SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        decided_at = now(),
        decided_by = auth.uid()
    WHERE id = _request_id;

  IF _approve THEN
    INSERT INTO public.subgroup_members (subgroup_id, user_id)
    VALUES (v_req.subgroup_id, v_req.user_id)
    ON CONFLICT (subgroup_id, user_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_join_request(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decide_join_request(uuid, boolean) TO authenticated;
